'use server';

import { and, eq, or, type WithSubqueryWithoutSelection } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { v4 as uuid } from 'uuid';
import type z from 'zod';

import { cleanupAddresses, cleanupConfigs } from '@/lib/actions/utils';
import { crypto } from '@/lib/encrypt';
import { isAddressEqual } from '@/lib/utils/address';
import { config as configInput } from '@/lib/validation/config';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';
import { invalidateActiveScd } from '@/db/schema/data/_helpers';

import { getSession } from '@/auth';

export async function updateUserConfig(config: z.infer<typeof configInput>) {
	// Authenticate the user
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	const vault = await crypto(session.user.id);

	// Validate the input data
	const { taxes, address, ...safeConfig } = await configInput.parseAsync(config).then(async v => ({
		...v,

		email: v.email ? await vault.encrypt(v.email) : null,
		phone: v.phone ? await vault.encrypt(v.phone) : null,
		header: v.header ? await vault.encrypt(v.header) : null,

		paymentDetails:
			v.paymentDetails.length > 0
				? await vault.encrypt(v.paymentDetails.map(v => `${v.label}: ${v.value}`))
				: null,

		registrationNumber:
			v.registrationNumber.length > 0
				? await vault.encrypt(v.registrationNumber.map(v => `${v.label}: ${v.value}`))
				: null,

		taxes: v.taxes.map((tax, i) => ({
			...tax,
			userId: session.user.id,
			order: i,
		})),
	}));

	return withRLS(async tx => {
		const configId = uuid();

		/** Checks the previous config to see if the address has changed.
		 * Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
		async function getAddressId() {
			if (!address) return null;
			if (!session) throw new Error('Request not authenticated');

			/** Returns the address recorded on the last config record and decrypts it */
			const lastConfigAddress = await tx.query.config
				.findFirst({
					where: { validTo: { isNull: true }, userId: session.user.id },
					with: { address: { columns: { userId: false } } },
					columns: { addressId: true },
				})
				.then(async res => res?.address && (await vault.decryptObject(res.address)));

			// If the address is unchanged, reuse the existing address record to prevent duplicate rows
			const isAddressUnchanged = isAddressEqual(address, lastConfigAddress);
			if (isAddressUnchanged) return lastConfigAddress.id;

			// Insert new address record
			const insertedAddress = await tx
				.insert(tables.address)
				.values({
					...address,
					streetAddress: address.streetAddress && (await vault.encrypt(address.streetAddress)),
					userId: session.user.id,
				})
				.returning({ id: tables.address.id })
				.then(([v]) => v);

			return insertedAddress.id;
		}

		// Void previously active config
		await invalidateActiveScd(tx, tables.config);

		// Define as CTEs for transactional behaviour without network round-trips
		const actions: WithSubqueryWithoutSelection<string>[] = [
			// Insert new config
			tx.$with('create_config').as(
				tx.insert(tables.config).values({
					...safeConfig,
					id: configId,
					userId: session.user.id,
					addressId: await getAddressId(),
				}),
			),
		];

		// If taxes are defined
		if (taxes?.length > 0) {
			// Insert new taxes; skip if already exists. Tax identity must be unique.
			// Fetch all IDs (both newly inserted and previously existing)
			const dbTaxes = await tx
				.with(
					tx.$with('insert_taxes').as(tx.insert(tables.taxes).values(taxes).onConflictDoNothing()),
				)
				.select()
				.from(tables.taxes)
				.where(
					or(
						...taxes.map(tax =>
							and(
								eq(tables.taxes.userId, tax.userId),
								eq(tables.taxes.name, tax.name),
								eq(tables.taxes.rate, tax.rate),
							),
						),
					),
				);

			actions.push(
				// Insert new tax-config junctions
				tx.$with('tax_config_junction').as(
					tx.insert(tables.configTaxes).values(
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
			.from(tables.config);
	})
		.finally(() => vault.destroy())
		.then(async () => {
			// Revalidate the cache for the invoices page, where the formatting may have changed.
			revalidatePath('/invoices');
			revalidatePath('/settings');

			// Useful to ensure consecutive insertions (eg. saving as progressing through form) do not produce redundant rows
			after(() =>
				Promise.all([cleanupConfigs(session.user.id), cleanupAddresses(session.user.id)]),
			);
		});
}
