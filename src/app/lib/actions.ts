'use server';

import { type AnyColumn, and, eq, isNull, sql } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import z from 'zod';
import { auth, signIn } from '@/auth';
import { db } from '@/db';
import {
	config as configSchema,
	// invoiceCount,
	invoices,
	invoices as invoicesSchema,
	taxes as taxesSchema,
} from '@/db/schema';
// import { getUserConfig } from '@/lib/data';
import type { Prettify } from '@/lib/utils';

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

// const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

export async function createInvoice(
	data: Prettify<Pick<typeof invoicesSchema.$inferInsert, 'clientId' | 'amount'>>,
): Promise<State> {
	const session = await auth();
	if (!session?.user?.id) {
		return {
			success: false,
			message: 'User is not authenticated',
		};
	}

	const inputSchema = createInsertSchema(invoicesSchema).omit({
		index: true,
		yearIndex: true,
		config: true,
		issueYear: true,
	});

	const defaults: z.infer<typeof inputSchema> = {
		status: 'unpaid',
		...data,
		userId: session.user.id,
	};

	// Validate form using Zod
	const validated = inputSchema.safeParse(defaults);

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validated.success) {
		return {
			success: false,
			errors: z.flattenError(validated.error),
			message: 'Failed to create invoice. Please ensure all fields are valid.',
		};
	}

	try {
		throw new Error('Function not implemented');
		// await db.transaction(async tx => {
		// 	const config = await getUserConfig(tx);

		// 	// Upsert: increment user invoice count
		// 	const count = await tx
		// 		.insert(invoiceCount)
		// 		.values({
		// 			userId: validated.data.userId,
		// 			count: 1,
		// 			yearCount: 1,
		// 		})
		// 		.onConflictDoUpdate({
		// 			target: invoiceCount.userId,
		// 			set: {
		// 				userId: validated.data.userId,
		// 				count: increment(invoiceCount.count),
		// 				yearCount: sql`
		// 					CASE
		// 					  -- Evaluate against config time zone. If the year is after the tracked date, reset the yearly counter.
		//               WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE ${config.timezone})
		//                   > EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE ${config.timezone})
		//               THEN 1

		//               -- Evaluate against config time zone. If the year is the same, increment the year count.
		//               WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE ${config.timezone})
		//                   = EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE ${config.timezone})
		//               THEN ${invoiceCount.yearCount} + 1

		//               -- If now() is before the tracked date, do nothing.
		//               ELSE ${invoiceCount.yearCount}
		//             END
		//             `,
		// 				updatedAt: sql`transaction_timestamp()`,
		// 			},
		// 		})
		// 		.returning()
		// 		.then(v => v[0]);

		// 	await tx.insert(invoices).values({
		// 		...validated.data,
		// 		index: count.count,
		// 		yearIndex: count.yearCount,
		// 		config: config.id,
		// 		issueYear: sql`EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE ${config.timezone})`,
		// 	});
		// });
	} catch (err) {
		console.error(err);
		return {
			message: `Database Error: failed to create invoice`,
			success: false,
		};
	}

	// Revalidate the cache for the invoices page
	// revalidatePath('/dashboard/invoices');

	// return {
	// 	success: true,
	// 	message: 'Invoice created',
	// };
}

const updateInvoiceSchema = createUpdateSchema(invoices).omit({ id: true });
export async function updateInvoice(id: string, data: z.input<typeof updateInvoiceSchema>) {
	const session = await auth();
	console.log(session);
	if (!session?.user?.id) {
		return {
			success: false,
			message: 'User is not authenticated',
		};
	}

	const { success, error, data: validated } = updateInvoiceSchema.safeParse(data);

	if (!success) {
		return {
			success: false,
			errors: z.flattenError(error),
			message: 'Invalid fields. Failed to update invoice.',
		};
	}

	if (Object.keys(validated).length === 0) {
		return {
			success: true,
			message: 'No fields to update',
		};
	}

	try {
		await db.update(invoices).set(validated).where(eq(invoices.id, id));
	} catch (_error) {
		return {
			success: false,
			message: 'Database Error: Failed to update invoice',
		};
	}

	revalidatePath('/dashboard/invoices');

	return {
		success: true,
		message: 'Invoice amended',
	};
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

/** Accepts array of tax data for the authenticated user. Sensitive to insertion order.
 *
 * Pushes provided state, and not merely changes (ie. implicit deletion of all existing taxes) */
function buildUpdateUserTaxes(taxes: TaxesSchema[], userId: string) {
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
		// Reset all taxes to deleted. This avoids having to manage insert and modification state, with reconciliation.
		db
			.update(taxesSchema)
			.set({ deleted: true })
			.where(eq(taxesSchema.userId, userId)),
		// Upsertion of provided values
		...(values.length > 0
			? [
					db
						.insert(taxesSchema)
						.values(values)
						.onConflictDoUpdate({
							target: [taxesSchema.userId, taxesSchema.name, taxesSchema.rate],
							set: { deleted: sql`excluded.deleted`, order: sql`excluded.order` },
						}),
				]
			: []),
	] as const;
}

/** Accepts array of tax data for the authenticated user. Sensitive to insertion order.
 *
 * Pushes provided state, and not merely changes (ie. implicit deletion of all existing taxes) */
export async function updateUserTaxes(taxes: TaxesSchema[]) {
	// Authenticate the user
	const session = await auth();
	if (!session?.user?.id) throw new Error('User is not authenticated');

	return db.batch(buildUpdateUserTaxes(taxes, session.user.id));
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

	// Executes as implicit transaction
	return db
		.batch([
			db
				.update(configSchema)
				.set({ validTo: sql`now()` })
				.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo))),
			db.insert(configSchema).values({ ...safeConfig, userId: session.user.id }),
			...(taxes ? buildUpdateUserTaxes(taxes, session.user.id) : []),
		])
		.then(() => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/dashboard/invoices');
			revalidatePath('/dashboard/settings');
		});
}
