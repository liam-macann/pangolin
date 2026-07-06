'use server';

import { and, eq, isNull, or } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import type z from 'zod';

import { cleanupAddresses, cleanupConfigs } from '@/lib/actions/utils';
import { crypto, type Vault } from '@/lib/encrypt';
import { percentToRate } from '@/lib/utils';
import { isAddressEqual } from '@/lib/utils/address';
import { config as configInput } from '@/lib/validation/config';
import { type AuthTransaction, withRLS } from '@/db';
import * as tables from '@/db/schema';
import { invalidateActiveScd } from '@/db/schema/data/_helpers';

export async function updateUserConfig(input: z.infer<typeof configInput>) {
	// Validate the input data
	const data = await configInput.parseAsync(input);

	return withRLS(async (db, session) => {
		const vault = await crypto(session.user.id);

		const { taxes, address, ...config } = await serializeConfig(data, vault, session.user.id);

		// Void previously active config
		await invalidateActiveScd(
			db,
			tables.config,
			await db
				.select({ id: tables.config.id })
				.from(tables.config)
				.where(and(isNull(tables.config.validTo), eq(tables.config.userId, session.user.id)))
				.limit(1)
				.then(([v]) => v?.id),
		);

		// Insert new config
		const [insertedConfig] = await db
			.insert(tables.config)
			.values({
				...config,
				userId: session.user.id,
				// Either finds a matching address in the DB, or creates a new one. Returns the row pkey.
				addressId: await getAddressId(db, vault, address, session.user.id),
			})
			.returning({ id: tables.config.id });

		vault.destroy();

		if (taxes?.length > 0) await insertTaxes(db, taxes, insertedConfig.id, session.user.id);

		// Useful to ensure consecutive insertions (eg. saving as progressing through form) do not produce redundant rows
		after(() => Promise.all([cleanupConfigs(session.user.id), cleanupAddresses(session.user.id)]));

		updateTag(`config-${session.user.id}`);
	});
}

const serializeConfig = async (
	data: z.infer<typeof configInput>,
	vault: Vault,
	userId: string,
) => ({
	...data,

	email: data.email ? await vault.encrypt(data.email) : null,
	phone: data.phone ? await vault.encrypt(data.phone) : null,
	header: data.header ? await vault.encrypt(data.header) : null,

	paymentDetails:
		data.paymentDetails.length > 0
			? await vault.encrypt(data.paymentDetails.map(v => `${v.label}: ${v.value}`))
			: null,

	tradingNumber:
		data.tradingNumber.length > 0
			? await vault.encrypt(data.tradingNumber.map(v => `${v.label}: ${v.value}`))
			: null,

	// Rates are validated as user-facing percentages; the database stores fractions as NUMERIC
	taxes: data.taxes.map(tax => ({
		...tax,
		rate: percentToRate(tax.rate),
		userId,
	})),
});

/** Checks the previous config to see if the address has changed.
 * Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
async function getAddressId(
	tx: AuthTransaction,
	vault: Vault,
	address: z.infer<typeof configInput>['address'],
	userId: string,
) {
	if (!address) return null;

	/** Returns the address recorded on the last config record and decrypts it */
	const lastConfigAddress = await tx.query.config
		.findFirst({
			where: { validTo: { isNull: true }, userId },
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
			userId,
		})
		.returning({ id: tables.address.id })
		.then(([v]) => v);

	return insertedAddress.id;
}

async function insertTaxes(
	tx: AuthTransaction,
	taxes: (typeof tables.taxes.$inferInsert)[],
	configId: string,
	userId: string,
) {
	// Insert taxes not already in database
	await tx.insert(tables.taxes).values(taxes).onConflictDoNothing();

	// Then select from both new and existing taxes
	const rows = await tx
		.select({ id: tables.taxes.id, name: tables.taxes.name, rate: tables.taxes.rate })
		.from(tables.taxes)
		.where(
			and(
				eq(tables.taxes.userId, userId),
				or(...taxes.map(t => and(eq(tables.taxes.name, t.name), eq(tables.taxes.rate, t.rate)))),
			),
		);

	const idByKey = new Map(rows.map(r => [`${r.name}::${r.rate}`, r.id]));

	await tx.insert(tables.configTaxes).values(
		taxes.map((t, i) => ({
			userId,
			configId,
			taxId: idByKey.get(`${t.name}::${t.rate}`) as string,
			order: i,
		})),
	);
}
