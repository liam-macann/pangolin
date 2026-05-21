'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type z from 'zod/v4';

import { cleanupAddresses, cleanupClientData } from '@/lib/actions/utils';
import { crypto } from '@/lib/encrypt';
import { isAddressEqual } from '@/lib/utils/address';
import { clientData as clientDataSchema } from '@/lib/validation/client';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';
import { clientData, clients } from '@/db/schema';

export async function updateClientFavorite(clientId: string, status: boolean) {
	await withRLS((db, session) =>
		db
			.update(clients)
			.set({ isFavorite: status })
			.where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id))),
	);
}

export async function updateClientDeleted(clientId: string, status: boolean) {
	await withRLS((db, session) =>
		db
			.update(clients)
			.set({ isDeleted: status })
			.where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id))),
	);
}

export async function createClient(input: Omit<z.infer<typeof clientDataSchema>, 'clientId'>) {
	// Validate form using Zod
	const data = clientDataSchema.omit({ clientId: true }).parse(input);

	await withRLS((db, session) => {
		const newClient = db
			.$with('create_client')
			.as(db.insert(clients).values({ userId: session.user.id }).returning({ id: clients.id }));

		return db
			.with(newClient)
			.insert(clientData)
			.values({ ...data, clientId: sql`(select id from ${newClient})`, userId: session.user.id });
	});
}

export async function updateClient(input: z.infer<typeof clientDataSchema>) {
	// Validate form using Zod
	const { address, ...data } = await clientDataSchema.parseAsync(input);

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
				.insert(tables.address)
				.values({
					...address,
					streetAddress: address.streetAddress && (await vault.encrypt(address.streetAddress)),
					userId: session.user.id,
				})
				.returning({ id: tables.address.id })
				.then(([v]) => v);

			vault.destroy();
			return insertedAddress.id;
		})();

		await db
			.update(clientData)
			.set({ validTo: sql`now()` })
			.where(
				and(
					isNull(clientData.validTo),
					eq(clientData.clientId, data.clientId),
					eq(clientData.userId, session.user.id),
				),
			);

		await db.insert(clientData).values({ ...data, userId: session.user.id, addressId });

		// Useful to ensure consecutive insertions do not produce redundant rows
		after(() =>
			Promise.all([cleanupClientData(session.user.id), cleanupAddresses(session.user.id)]),
		);
	}).then(async () => {
		// Revalidate the cache for the invoices page, where the formatting may have changed.
		revalidatePath('/invoices');
		revalidatePath(`/clients/${data.clientId}`);
	});
}
