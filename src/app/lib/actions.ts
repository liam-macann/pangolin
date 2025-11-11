'use server';

import { type AnyColumn, and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { v4 as uuid } from 'uuid';
import z from 'zod';
import { auth, signIn } from '@/auth';
import { db } from '@/db';
import {
	config as configSchema,
	invoiceCount,
	invoiceItems,
	invoices as invoicesSchema,
	itemTaxes,
	type statusEnum,
	taxes as taxesSchema,
} from '@/db/schema';
import type { Prettify } from '@/lib/utils';
import { type Enum, jsonbBuildObject } from './utils/drizzle';

export type State =
	| {
			success: false;
			errors?: {
				formErrors: string[];
				fieldErrors: Record<string, string[] | undefined>;
			};
			message?: string | null;
	  }
	| {
			success: true;
			message: string;
	  };

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

type InvoiceData = Pick<
	typeof invoicesSchema.$inferInsert,
	'clientId' | 'title' | 'description' | 'notes'
> & {
	// These are naively accepted in timezone of record, truncated to only date. createdAt stores a tz timestamp.
	issuedAt?: Date;
	dueAt: Date;
	status?: (typeof invoicesSchema.$inferInsert)['status'];
};

type InvoiceItemData = Pick<
	typeof invoiceItems.$inferInsert,
	'label' | 'note' | 'quantity' | 'unit' | 'unitCost' | 'order'
>;

interface CreateInvoiceData {
	invoice: InvoiceData;

	items: (InvoiceItemData & {
		/** Supply applicable taxes as array of tax IDs */
		taxes: string[];
	})[];
}

export async function createInvoice({ invoice, items }: CreateInvoiceData) {
	const session = await auth();

	// Pre request validation. Validation has also been performed on the client side.
	const inputSchema = createInsertSchema(invoicesSchema, {
		issuedAt: s => s.nullable(), // Has default set in transaction logic (current date in timezone of record)
	})
		// Omit generated fields
		.omit({
			id: true,
			index: true,
			yearIndex: true,
			config: true,
			createdAt: true,
		});

	// Explicit about accepted input to prevent injecting via spread operator
	const defaults: z.infer<typeof inputSchema> = {
		clientId: invoice.clientId,
		title: invoice.title,
		description: invoice.description,
		status: invoice.status || 'unpaid',
		notes: invoice.notes,
		issuedAt: invoice.issuedAt?.toISOString() || null,
		dueAt: invoice.dueAt.toISOString(),

		// Ensure invoice is created for authenticated user, not supplied ID
		userId: session.user.id,
	};

	// Validate form using Zod
	const validated = inputSchema.safeParse(defaults);

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validated.success) throw new Error('Failed to create invoice. Ensure all fields are valid.');

	return db
		.transaction(async tx => {
			const tzSubquery = tx
				.select({ timezone: configSchema.timezone })
				.from(configSchema)
				.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo)))
				.orderBy(desc(configSchema.validFrom))
				.limit(1)
				.getSQL();

			// Upsert watermark table with invoice count
			const [count] = await tx
				.insert(invoiceCount)
				.values({
					userId: session.user.id,
					updatedAt: sql`transaction_timestamp()`,
					count: 1,
					yearCount: 1,
				})
				.onConflictDoUpdate({
					target: invoiceCount.userId,
					set: {
						updatedAt: sql`transaction_timestamp()`,
						count: increment(invoiceCount.count),
						yearCount: sql`
        				CASE
      				  -- Evaluate against config time zone. If the year is after the tracked date, reset the yearly counter.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                      > EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN 1
                    -- Evaluate against config time zone. If the year is the same, increment the year count.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                        = EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN ${invoiceCount.yearCount} + 1
                    -- If now() is before the tracked date, do nothing.
                    ELSE ${invoiceCount.yearCount}
                END
                `,
					},
					where: and(eq(invoiceCount.userId, session.user.id)),
				})
				.returning({
					count: invoiceCount.count,
					yearCount: invoiceCount.yearCount,
				});

			// CTE, executed within insert to retrieve current valid config
			const c = tx.$with('active_config').as(
				tx
					.select({
						id: configSchema.id,
						userId: configSchema.userId,
						timezone: configSchema.timezone,
						taxRegistration: configSchema.taxRegistration,
					})
					.from(configSchema)
					.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo)))
					.orderBy(desc(configSchema.validFrom))
					.limit(1),
			);

			const [insertedInvoice] = await tx
				.with(c)
				.insert(invoicesSchema)
				.values([
					{
						userId: validated.data.userId,
						clientId: validated.data.clientId,

						title: validated.data.title,
						description: validated.data.description,
						status: validated.data.status,
						notes: validated.data.notes,

						issuedAt:
							validated.data.issuedAt ||
							sql`transaction_timestamp() AT TIME ZONE (SELECT timezone from ${c})`,
						dueAt: validated.data.dueAt,

						index: count.count,
						yearIndex: count.yearCount,

						config: sql<string>`(SELECT id from ${c})`,
					},
				])
				.returning({
					id: invoicesSchema.id,
					config: jsonbBuildObject({
						taxRegistration: sql<boolean>`(SELECT tax_registration from ${c})`,
					}),
				});

			// Necessary to have stable ID to link taxes with items
			const itemsWithId = items.map((item, i) => ({
				...item,
				id: uuid(),
				order: i,
			}));

			// Insert items for invoice
			await tx
				.insert(invoiceItems)
				.values(
					itemsWithId.map(i => ({
						id: i.id,
						invoiceId: insertedInvoice.id,

						label: i.label,
						note: i.note,

						quantity: i.quantity,
						unit: i.unit,
						unitCost: i.unitCost,

						order: i.order,
					})),
				)
				.then(async () => {
					// Link items with taxes, if registered
					if (insertedInvoice.config.taxRegistration) {
						await tx
							.insert(itemTaxes)
							.values(
								itemsWithId.flatMap(item => item.taxes.map(taxId => ({ itemId: item.id, taxId }))),
							);
					}
				});
		})
		.then(() => revalidatePath('/dashboard/invoices'))
		.catch(err => {
			console.error(err);
			throw new Error(`Database Error: failed to create invoice`);
		});
}

export async function updateInvoiceStatus(id: string, status: Enum<typeof statusEnum>) {
	await db.update(invoicesSchema).set({ status }).where(eq(invoicesSchema.id, id));
}

export async function authenticate(_prevState: string | undefined, formData: FormData) {
	try {
		await signIn('credentials', formData);
	} catch (error) {
		if (error instanceof AuthError) {
			switch (error.type) {
				case 'CredentialsSignin':
					return 'Invalid email or password';
				default:
					return 'Something went wrong';
			}
		}
		throw error;
	}
}

/** Minimal insertion record for database configuration, excluding generated fields */
type TaxesSchema = Prettify<Pick<typeof taxesSchema.$inferInsert, 'name' | 'rate' | 'deleted'>>;

/** Accepts array of tax data for a given user.
 *
 * Pushes provided state, and not merely changes (ie. implicit deletion of all existing taxes)
 *
 * @internal
 */
function updateUserTaxesCTEs(taxes: TaxesSchema[], userId: string) {
	// Validate the input data
	const safeTaxes = z
		.array(
			createInsertSchema(taxesSchema).pick({
				name: true,
				rate: true,
				deleted: true,
			}),
		)
		.parse(taxes);

	// Avoid spread to ensure disallowed fields are not inserted, without requiring strict object validation
	const values = safeTaxes.map((t, i) => ({
		name: t.name,
		rate: t.rate,
		order: i,
		deleted: t.deleted,
		userId,
	}));

	return [
		db
			// Reset all taxes to deleted. This avoids reconciliation (input taxes are representative of desired state)
			.$with('reset_taxes')
			.as(db.update(taxesSchema).set({ deleted: true }).where(eq(taxesSchema.userId, userId))),

		db
			// Push new state
			.$with('update_taxes')
			.as(
				db
					.insert(taxesSchema)
					.values(values)
					.onConflictDoUpdate({
						target: [taxesSchema.userId, taxesSchema.name, taxesSchema.rate],
						set: { deleted: sql`excluded.deleted`, order: sql`excluded.order` },
					}),
			),
	];
}

/** Complete insertion record for database configuration, excluding generated fields */
type ConfigSchema = Prettify<
	Omit<typeof configSchema.$inferInsert, 'userId' | 'id' | 'validFrom' | 'validTo'>
>;

export async function updateUserConfig(config: ConfigSchema, taxes?: TaxesSchema[]) {
	// Authenticate the user
	const session = await auth();
	if (!session?.user?.id) throw new Error('User is not authenticated');

	// Validate the input data
	const safeConfig = createInsertSchema(configSchema)
		.omit({
			id: true,
			userId: true,
			validFrom: true,
			validTo: true,
		})
		.strict()
		.parse(config);

	const ctes = [
		// Void previously active config
		db
			.$with('void_config')
			.as(
				db
					.update(configSchema)
					.set({ validTo: sql`now()` })
					.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo))),
			),
		// Push new tax config
		...(taxes ? updateUserTaxesCTEs(taxes, session.user.id) : []),
	];

	// Executes as implicit transaction
	return db
		.with(...ctes)
		.insert(configSchema)
		.values({ ...safeConfig, userId: session.user.id })
		.then(() => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/dashboard/invoices');
			revalidatePath('/dashboard/settings');
		});
}
