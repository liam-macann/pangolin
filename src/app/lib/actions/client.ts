'use server';

import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { getSession } from '@/auth';
import { db } from '@/db';
import { clients } from '@/db/schema';

export async function updateClientFavorite(clientId: string, status: boolean) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(clients)
		.set({ isFavorite: status })
		.where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id)));
}
