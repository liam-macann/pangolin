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

export async function updateUserConfig(input: z.infer<typeof configInput>) {
	// Validate the input data
	const data = await configInput.parseAsync(input);

	return withRLS(async (db, session) => {
		const vault = await crypto(session.user.id);

		const { taxes, address, ...safeConfig } = {
			...data,

			email: data.email ? await vault.encrypt(data.email) : null,
			phone: data.phone ? await vault.encrypt(data.phone) : null,
			header: data.header ? await vault.encrypt(data.header) : null,

			paymentDetails:
				data.paymentDetails.length > 0
					? await vault.encrypt(data.paymentDetails.map(v => `${v.label}: ${v.value}`))
					: null,

			registrationNumber:
				data.registrationNumber.length > 0
					? await vault.encrypt(data.registrationNumber.map(v => `${v.label}: ${v.value}`))
					: null,

			taxes: data.taxes.map((tax, i) => ({ ...tax, userId: session.user.id, order: i })),
		};

		const configId = uuid();

		/** Checks the previous config to see if the address has changed.
		 * Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
		async function getAddressId() {
			if (!address) return null;
			if (!session) throw new Error('Request not authenticated');

			/** Returns the address recorded on the last config record and decrypts it */
			const lastConfigAddress = await db.query.config
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
			const insertedAddress = await db
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
		await invalidateActiveScd(db, tables.config);

		// Define as CTEs for transactional behaviour without network round-trips
		const actions: WithSubqueryWithoutSelection<string>[] = [
			// Insert new config
			db.$with('create_config').as(
				db.insert(tables.config).values({
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
			const dbTaxes = await db
				.with(
					db.$with('insert_taxes').as(db.insert(tables.taxes).values(taxes).onConflictDoNothing()),
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
				db.$with('tax_config_junction').as(
					db.insert(tables.configTaxes).values(
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

		vault.destroy();

		// Useful to ensure consecutive insertions (eg. saving as progressing through form) do not produce redundant rows
		after(() => Promise.all([cleanupConfigs(session.user.id), cleanupAddresses(session.user.id)]));

		return await db
			.with(...actions)
			.select()
			.from(tables.config);
	}).then(() => {
		// Revalidate the cache for the invoices page, where the formatting may have changed.
		revalidatePath('/invoices');
		revalidatePath('/settings');
	});
}
