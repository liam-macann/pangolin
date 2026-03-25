'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clients } from '@/db/schema';

import { getSession } from '@/auth';

export async function updateClientFavorite(clientId: string, status: boolean) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(clients)
		.set({ isFavorite: status })
		.where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id)));
}
