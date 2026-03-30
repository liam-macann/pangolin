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
import { after } from 'next/server';
import { v4 as uuid } from 'uuid';
import type z from 'zod';

import { crypto } from '@/lib/encrypt';
import { isAddressEqual } from '@/lib/utils/address';
import { config as configInput } from '@/lib/validation/config';
import { db } from '@/db';
import {
	address as addressSchema,
	config as configSchema,
	configTaxes as configTaxesSchema,
	invoices as invoicesSchema,
	taxes as taxesSchema,
} from '@/db/schema';

import { getSession } from '@/auth';

export async function updateUserConfig(config: z.infer<typeof configInput>) {
	// Authenticate the user
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	const vault = await crypto(session.user.id);

	// Validate the input data
	const { taxes, ...safeConfig } = await configInput.parseAsync(config).then(async v => ({
		...v,

		email: v.email ? await vault.encrypt(v.email).then(([r]) => r) : null,
		phone: v.phone ? await vault.encrypt(v.phone).then(([r]) => r) : null,
		header: v.header ? await vault.encrypt(v.header).then(([r]) => r) : null,

		paymentDetails:
			v.paymentDetails.length > 0
				? await vault.encrypt(...v.paymentDetails.map(v => `${v.label}: ${v.value}`))
				: null,

		registrationNumber:
			v.registrationNumber.length > 0
				? await vault.encrypt(...v.registrationNumber.map(v => `${v.label}: ${v.value}`))
				: null,

		taxes: v.taxes.map((tax, i) => ({
			...tax,
			userId: session.user.id,
			order: i,
		})),
	}));

	return db
		.transaction(async tx => {
			const configId = uuid();

			/** Checks the previous config to see if the address has changed.
			 * Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
			async function getAddressId() {
				if (!safeConfig.address) return null;
				if (!session) throw new Error('Request not authenticated');

				/** Returns the address recorded on the last config record and decrypts it */
				const lastConfigAddress = await tx.query.config
					.findFirst({
						where: { validTo: { isNull: true }, userId: session.user.id },
						with: { address: { columns: { userId: false } } },
						columns: { addressId: true },
					})
					.then(
						async res =>
							res?.address && {
								...res.address,
								streetAddress:
									res.address.streetAddress && (await vault.decrypt(...res.address.streetAddress)),
							},
					);

				const isAddressUnchanged =
					lastConfigAddress && isAddressEqual(lastConfigAddress, safeConfig.address);

				// If the address is unchanged, reuse the existing address record to prevent duplicate rows
				if (isAddressUnchanged) return lastConfigAddress.id;

				// Insert new address record
				const insertedAddress = await tx
					.insert(addressSchema)
					.values({
						...safeConfig.address,
						streetAddress:
							safeConfig.address.streetAddress &&
							(await vault.encrypt(...safeConfig.address.streetAddress)),
						userId: session.user.id,
					})
					.returning({ id: addressSchema.id })
					.then(([v]) => v);

				return insertedAddress.id;
			}

			// Define as CTEs for transactional behaviour without network round-trips
			const actions: WithSubqueryWithoutSelection<string>[] = [
				// Insert new config
				tx.$with('create_config').as(
					tx.insert(configSchema).values({
						...safeConfig,
						id: configId,
						userId: session.user.id,
						addressId: await getAddressId(),
					}),
				),

				// Void previously active config
				tx.$with('void_config').as(
					tx
						.update(configSchema)
						.set({ validTo: sql`now()` })
						.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo))),
				),
			];

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
					tx.$with('tax_config_junction').as(
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
		.finally(() => vault.destroy())
		.then(async () => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/dashboard/invoices');
			revalidatePath('/dashboard/settings');

			// Useful to ensure consecutive insertions (eg. saving as progressing through form) do not produce redundant rows
			after(() => databaseCleanup(session.user.id));
		});
}

/** Clean up unused configs and addresses for a given user */
async function databaseCleanup(userId: string) {
	await Promise.all([
		db
			.delete(configSchema)
			.where(
				and(
					eq(configSchema.userId, userId),
					isNotNull(configSchema.validTo),
					notExists(
						// No invoices reference config row
						db.select().from(invoicesSchema).where(eq(invoicesSchema.configId, configSchema.id)),
					),
				),
			)
			// Error should not bubble up: non-essential cleanup
			.catch(() => console.error('Unable to clean up unused configs')),

		db
			.delete(addressSchema)
			.where(
				and(
					eq(addressSchema.userId, userId),
					notExists(
						// No configs reference address row
						db.select().from(configSchema).where(eq(configSchema.addressId, addressSchema.id)),
					),
				),
			)
			.catch(() => console.error('Unable to clean up unused addresses')),
	]);
}
