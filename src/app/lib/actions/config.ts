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
import type { Prettify } from '@/lib/utils';

/** Minimal insertion record for database configuration, excluding generated fields */
type TaxesSchema = Prettify<Pick<typeof taxesSchema.$inferInsert, 'name' | 'rate' | 'id'>>;

/** Complete insertion record for database configuration, excluding generated fields */
type ConfigSchema = Prettify<
	Omit<typeof configSchema.$inferInsert, 'userId' | 'id' | 'validFrom' | 'validTo'>
>;

export async function updateUserConfig(config: ConfigSchema, taxes?: TaxesSchema[]) {
	// Authenticate the user
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

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

	const safeTaxes = z
		.array(
			createInsertSchema(taxesSchema).pick({
				id: true,
				name: true,
				rate: true,
			}),
		)
		.parse(taxes)
		.map((tax, i) => ({
			// ID must be known for both insertion and junction CTEs.
			// Allow provided data to override, so that taxes are not duplicated on each config update.
			id: uuid(),
			...tax,
			userId: session.user.id,
			order: i,
		}));

	const configId = uuid();

	// Define as CTEs for transactional behaviour
	const actions: WithSubqueryWithoutSelection<string>[] = [
		// Insert new config
		db
			.$with('create_config')
			.as(db.insert(configSchema).values({ ...safeConfig, id: configId, userId: session.user.id })),

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
							db.insert(configTaxes).values(
								safeTaxes.map(tax => ({
									configId,
									taxId: tax.id,
									order: tax.order,
								})),
							),
						),
				]
			: []),
	];

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
