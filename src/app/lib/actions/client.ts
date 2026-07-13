'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import type z from 'zod/v4';

import { cleanupAddresses, cleanupClientData } from '@/lib/actions/utils';
import { crypto } from '@/lib/encrypt';
import { isAddressEqual } from '@/lib/utils/address';
import { clientData, clientDataFields } from '@/lib/validation/client';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';
import { invalidateActiveScd } from '@/db/schema/data/_helpers';

export async function updateClientFavorite(clientId: string, status: boolean) {
	await withRLS(async (db, session) => {
		await db
			.update(schema.clients)
			.set({ isFavorite: status })
			.where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, session.user.id)));

		updateTag(`clients-${session.user.id}`);
	});
}

export async function updateClientDeleted(clientId: string, status: boolean) {
	await withRLS(async (db, session) => {
		await db
			.update(schema.clients)
			.set({ isDeleted: status })
			.where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, session.user.id)));

		updateTag(`clients-${session.user.id}`);
	});
}

/** Creates a new client for the current user */
export async function createClient(input: Omit<z.infer<typeof clientData>, 'clientId'>) {
	// Validate form using Zod
	const data = clientDataFields
		.omit({ clientId: true })
		.refine(c => c.name || c.organization, {
			message: 'Name or organisation must be present',
			path: ['name'],
		})
		.parse(input);

	return await withRLS(async (db, session) => {
		const newClient = db
			.$with('create_client')
			.as(
				db
					.insert(schema.clients)
					.values({ userId: session.user.id })
					.returning({ id: schema.clients.id }),
			);

		await db
			.with(newClient)
			.insert(schema.clientData)
			.values({ ...data, clientId: sql`(select id from ${newClient})`, userId: session.user.id })
			.returning({ id: schema.clientData.id });

		updateTag(`clients-${session.user.id}`);
	});
}

export async function updateClient(input: z.infer<typeof clientData>) {
	// Validate form using Zod
	const { address, ...data } = await clientData.parseAsync(input);

	await withRLS(async (db, session) => {
		/** Checks the previous clientData to see if the address has changed.
		 * 	Returns the address ID if unchanged, otherwise inserts a new record and returns the new ID */
		const addressId = await (async function getAddressId() {
			if (!address) return null;
			if (!session) throw new Error('Request not authenticated');

			const vault = await crypto(session.user.id);

			/** Returns the address recorded on the last config record and decrypts it */
			const lastConfigAddress = await db.query.clientData
				.findFirst({
					where: { validTo: { isNull: true }, userId: session.user.id, clientId: data.clientId },
					with: { address: { columns: { userId: false } } },
					columns: { addressId: true },
				})
				.then(async res => res?.address && (await vault.decryptObject(res.address)));

			// If the address is unchanged, reuse the existing address record to prevent duplicate rows
			const isAddressUnchanged = isAddressEqual(address, lastConfigAddress);
			if (isAddressUnchanged) return lastConfigAddress.id;

			// Insert new address record
			const insertedAddress = await db
				.insert(schema.address)
				.values({
					...address,
					streetAddress: address.streetAddress && (await vault.encrypt(address.streetAddress)),
					userId: session.user.id,
				})
				.returning({ id: schema.address.id })
				.then(([v]) => v);

			vault.destroy();
			return insertedAddress.id;
		})();

		// Void previously active config
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

		await db.insert(schema.clientData).values({ ...data, userId: session.user.id, addressId });

		updateTag(`clients-${session.user.id}`);
		updateTag(`invoices-${session.user.id}`);

		// Useful to ensure consecutive insertions do not produce redundant rows
		after(() =>
			Promise.all([cleanupClientData(session.user.id), cleanupAddresses(session.user.id)]),
		);
	});
}
