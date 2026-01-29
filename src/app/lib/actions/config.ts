'use server';

import {
	and,
	eq,
	isNotNull,
	isNull,
	notExists,
	sql,
	type WithSubqueryWithoutSelection,
} from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';
import type z from 'zod';
import { getSession } from '@/auth';
import { db } from '@/db';
import {
	config as configSchema,
	configTaxes as configTaxesSchema,
	invoices as invoicesSchema,
	taxes as taxesSchema,
} from '@/db/schema';
import { crypto } from '@/lib/encrypt';

import { config as configInput } from '../validation/config';

export async function updateUserConfig(config: z.infer<typeof configInput>) {
	// Authenticate the user
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	// Validate the input data
	const { taxes, ...safeConfig } = await configInput.parseAsync(config).then(v => ({
		...v,
		taxes: v.taxes.map((tax, i) => ({
			...tax,
			userId: session.user.id,
			order: i,
		})),
	}));

	const configId = uuid();
	const vault = await crypto(session.user.id);

	// Define as CTEs for transactional behaviour
	const actions: WithSubqueryWithoutSelection<string>[] = [];

	actions.push(
		// Insert new config
		db
			.$with('create_config')
			.as(
				db.insert(configSchema).values({
					...safeConfig,
					id: configId,
					userId: session.user.id,
					paymentDetails:
						safeConfig.paymentDetails.length > 0
							? await vault.encrypt(...safeConfig.paymentDetails.map(v => `${v.label}: ${v.value}`))
							: null,
					registrationNumber:
						safeConfig.registrationNumber.length > 0
							? await vault.encrypt(
									...safeConfig.registrationNumber.map(v => `${v.label}: ${v.value}`),
								)
							: null,
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
	);

	vault.destroy();

	return db
		.transaction(async tx => {
			// If taxes are defined
			if (taxes?.length > 0) {
				// Insert new taxes; skip if already exists. Tax identity must be unique.
				const dbTaxes = await tx
					.insert(taxesSchema)
					.values(taxes)
					// Necessary to perform empty update to return values
					.onConflictDoUpdate({
						target: [taxesSchema.userId, taxesSchema.name, taxesSchema.rate],
						set: { userId: taxesSchema.userId },
					})
					.returning();

				actions.push(
					// Insert new tax-config junctions
					tx
						.$with('tax_config_junction')
						.as(
							tx.insert(configTaxesSchema).values(
								taxes.map(tax => {
									// Find the tax id in the database, using returned values from insert
									// Necessary as order is not in tax db schema, and so can't be piped down with CTEs
									const taxId = dbTaxes.find(i => i.name === tax.name && i.rate === tax.rate);
									if (!taxId)
										throw new Error(`Tax ${tax.name} with rate ${tax.rate} not found in database`);

									return {
										...tax,
										configId,
										taxId: taxId.id,
									};
								}),
							),
						),
				);
			}

			return await tx
				.with(...actions)
				.select()
				.from(configSchema);
		})
		.then(async () => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/dashboard/invoices');
			revalidatePath('/dashboard/settings');

			// Clean up unused configs
			// Useful to ensure consecutive insertions (eg. saving as progressing through form) do not produce redundant rows
			await db.delete(configSchema).where(
				and(
					eq(configSchema.userId, session.user.id),
					isNotNull(configSchema.validTo),
					notExists(
						// No invoices reference config row
						db
							.select()
							.from(invoicesSchema)
							.where(eq(invoicesSchema.configId, configSchema.id)),
					),
				),
			);
		});
}
