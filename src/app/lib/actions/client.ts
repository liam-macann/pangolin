'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { notFound, unauthorized } from 'next/navigation';
import { after } from 'next/server';
import type z from 'zod/v4';

import { type Address } from '@/api/dto/address';
import { cleanupAddresses, cleanupClientData } from '@/lib/actions/utils';
import { withVault } from '@/lib/encrypt';
import { isAddressEqual } from '@/lib/utils/address';
import { clientData, clientDataCreate } from '@/lib/validation/client';
import { type AuthTransaction, withRLS } from '@/db';
import * as schema from '@/db/schema';
import { invalidateActiveScd } from '@/db/schema/data/_helpers';

import { getSession } from '@/auth';

export async function updateClientFavorite(clientId: string, status: boolean) {
	await withRLS(async (db, session) => {
		const [client] = await db
			.update(schema.clients)
			.set({ isFavorite: status })
			.where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, session.user.id)))
			.returning({ id: schema.clients.id });

		if (!client) notFound();

		updateTag(`clients-${session.user.id}`);
	});
}

export async function updateClientDeleted(clientId: string, status: boolean) {
	await withRLS(async (db, session) => {
		const [client] = await db
			.update(schema.clients)
			.set({ isDeleted: status })
			.where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, session.user.id)))
			.returning({ id: schema.clients.id });

		if (!client) notFound();

		updateTag(`clients-${session.user.id}`);
	});
}

/** Creates a new client for the current user, and returns the logical client id and the created clientData id */
export async function createClient(input: z.infer<typeof clientDataCreate>) {
	// Validate form using Zod
	const data = await clientDataCreate.parseAsync(input);

	return await withRLS(async (db, session) => {
		// Inserts a new logical client
		const [{ id }] = await db
			.insert(schema.clients)
			.values({ userId: session.user.id })
			.returning({ id: schema.clients.id });

		const scdId = await insertClientData(db, { ...data, clientId: id });

		updateTag(`clients-${session.user.id}`);

		return { id, scdId };
	});
}

export async function updateClient(input: z.infer<typeof clientData>) {
	// Validate form using Zod
	const data = await clientData.parseAsync(input);

	await withRLS(async (db, session) => {
		const [client] = await db
			.select({ id: schema.clients.id })
			.from(schema.clients)
			.where(and(eq(schema.clients.id, data.clientId), eq(schema.clients.userId, session.user.id)));

		if (!client) notFound();

		await insertClientData(db, data);

		updateTag(`clients-${session.user.id}`);

		// Useful to ensure consecutive insertions do not produce redundant rows
		after(() =>
			Promise.all([cleanupClientData(session.user.id), cleanupAddresses(session.user.id)]),
		);
	});
}

/** Inserts a new active clientData row for the given logical client
 *
 * - resolves the address foreign key
 * - voids the previously active row
 * - inserts the new, active version */
async function insertClientData(
	db: AuthTransaction,
	{ address, ...data }: z.infer<typeof clientData>,
) {
	const session = await getSession();
	if (!session) return unauthorized();

	// Must run before invalidation
	// The reuse lookup depends on the previous record still being active
	const addressId = await getAddressId(
		db,
		data.clientId,
		address
			? {
					...address,
					streetAddress: address.streetAddress ?? null,
					dependentLocality: address.dependentLocality ?? null,
					city: address.city ?? null,
					administrativeArea: address.administrativeArea ?? null,
					postalCode: address.postalCode ?? null,
					sortingCode: address.sortingCode ?? null,
				}
			: null,
	);

	// Void previously active client data
	await invalidateActiveScd(
		db,
		schema.clientData,
		await db
			.select({ id: schema.clientData.id })
			.from(schema.clientData)
			.where(
				and(
					isNull(schema.clientData.validTo),
					eq(schema.clientData.clientId, data.clientId),
					eq(schema.clientData.userId, session.user.id),
				),
			)
			.limit(1)
			.then(([v]) => v?.id),
	);

	const [{ id }] = await db
		.insert(schema.clientData)
		.values({ ...data, userId: session.user.id, addressId })
		.returning({ id: schema.clientData.id });

	return id;
}

/** Checks the previous clientData to see if the address has changed.
 * Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
async function getAddressId(db: AuthTransaction, clientId: string, address: Address | null) {
	if (!address) return null;

	const session = await getSession();
	if (!session) return unauthorized();

	return withVault(async vault => {
		/** Returns the address recorded on the last clientData record and decrypts it */
		const lastClientAddress = await db.query.clientData
			.findFirst({
				where: { validTo: { isNull: true }, userId: session.user.id, clientId },
				with: { address: { columns: { userId: false } } },
				columns: { addressId: true },
			})
			.then(async res => res?.address && (await vault.decryptObject(res.address)));

		// If the address is unchanged, reuse the existing address record to prevent duplicate rows
		const isAddressUnchanged = isAddressEqual(address, lastClientAddress);
		if (isAddressUnchanged) return lastClientAddress.id;

		// Insert new address record
		const insertedAddress = await db
			.insert(schema.address)
			.values({
				...address,
				streetAddress: address.streetAddress && (await vault.encrypt([...address.streetAddress])),
				userId: session.user.id,
			})
			.returning({ id: schema.address.id })
			.then(([v]) => v);

		return insertedAddress.id;
	});
}
