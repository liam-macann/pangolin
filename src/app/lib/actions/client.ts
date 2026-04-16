'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import type z from 'zod/v4';

import { clientData as clientDataSchema } from '@/lib/validation/client';
import { db } from '@/db';
import { clientData, clients } from '@/db/schema';

import { getSession } from '@/auth';

export async function updateClientFavorite(clientId: string, status: boolean) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(clients)
		.set({ isFavorite: status })
		.where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id)));
}

export async function createClient(input: Omit<z.infer<typeof clientDataSchema>, 'clientId'>) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	// Validate form using Zod
	const data = clientDataSchema.omit({ clientId: true }).parse(input);

	const newClient = db
		.$with('create_client')
		.as(db.insert(clients).values({ userId: session.user.id }).returning({ id: clients.id }));

	await db
		.with(newClient)
		.insert(clientData)
		.values({ ...data, clientId: sql`(select id from ${newClient})`, userId: session.user.id });
}

export async function updateClient(input: z.infer<typeof clientDataSchema>) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	// Validate form using Zod
	const data = clientDataSchema.parse(input);

	// Must be a transaction to allow insert to see updated DB snapshot
	await db.transaction(async tx => {
		await tx
			.update(clientData)
			.set({ validTo: sql`now()` })
			.where(
				and(
					isNull(clientData.validTo),
					eq(clientData.clientId, data.clientId),
					eq(clientData.userId, session.user.id),
				),
			);

		await tx.insert(clientData).values({ ...data, userId: session.user.id });
	});
}
