'use server';

import { and, eq, isNull, sql, type WithSubqueryWithoutSelection } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { v4 as uuid } from 'uuid';
import z from 'zod';
import { getSession } from '@/auth';
import { db } from '@/db';
import { config as configSchema, configTaxes, taxes as taxesSchema } from '@/db/schema';
import { crypto } from '@/lib/encrypt';

/** Complete insertion record for database configuration, excluding generated fields */
const configInput = createInsertSchema(configSchema, {
	paymentDetails: z
		.array(
			z.object({
				label: z.string().min(1).max(255),
				value: z.string().min(1).max(255),
			}),
		)
		.max(15)
		.optional(),
})
	.omit({
		id: true,
		userId: true,
		validFrom: true,
		validTo: true,
	})
	.strict();

/** Minimal insertion record for database configuration, excluding generated fields */
const taxInput = z.array(
	createInsertSchema(taxesSchema).pick({
		id: true,
		name: true,
		rate: true,
	}),
);

export async function updateUserConfig(
	config: z.infer<typeof configInput>,
	taxes?: z.infer<typeof taxInput>,
) {
	// Authenticate the user
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	// Validate the input data
	const safeConfig = configInput.parse(config);
	const safeTaxes = taxInput.parse(taxes).map((tax, i) => ({
		// ID must be known for both insertion and junction CTEs.
		// Allow provided data to override, so that taxes are not duplicated on each config update.
		id: uuid(),
		...tax,
		userId: session.user.id,
		order: i,
	}));

	const configId = uuid();
	const vault = await crypto(session.user.id);

	const paymentDetails =
		safeConfig.paymentDetails &&
		(await vault.encrypt(...safeConfig.paymentDetails.map(v => `${v.label}: ${v.value}`)));

	console.log('paymentDetails', paymentDetails);
	console.log('sample', [new Uint8Array(new TextEncoder().encode('hello'))]);

	// Define as CTEs for transactional behaviour
	const actions: WithSubqueryWithoutSelection<string>[] = [
		// Insert new config
		db
			.$with('create_config')
			.as(
				db.insert(configSchema).values({
					...safeConfig,
					id: configId,
					userId: session.user.id,
					paymentDetails: paymentDetails || null,
				}),
			),

		// Void previously active config
		db
			.$with('void_config')
			.as(
				db
					.update(configSchema)
					.set({ validTo: sql`now()` })
					.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo))),
			),

		// If taxes are defined
		...(safeTaxes?.length > 0
			? [
					// Insert new taxes
					db
						.$with('define_taxes')
						.as(db.insert(taxesSchema).values(safeTaxes).onConflictDoNothing()),

					// Insert new tax-config junctions
					db
						.$with('tax_config_junction')
						.as(
							db
								.insert(configTaxes)
								.values(safeTaxes.map(tax => ({ configId, taxId: tax.id, order: tax.order }))),
						),
				]
			: []),
	];

	vault.destroy();

	return db
		.with(...actions)
		.select()
		.from(configSchema)
		.then(() => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/dashboard/invoices');
			revalidatePath('/dashboard/settings');
		});
}
