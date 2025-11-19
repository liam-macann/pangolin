'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { revalidatePath } from 'next/cache';
import z from 'zod';
import { auth } from '@/auth';
import { db } from '@/db';
import { config as configSchema, taxes as taxesSchema } from '@/db/schema';
import type { Prettify } from '@/lib/utils';

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

//
//
//
// Sole exported endpoint
//

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
