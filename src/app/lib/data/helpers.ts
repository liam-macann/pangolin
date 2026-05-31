import { unauthorized, unstable_rethrow } from 'next/navigation';

import { getSession, type Session } from '@/auth';

export async function query<T>(
	fn: (session: Session) => Promise<T>,
	errorMessage: string,
): Promise<T> {
	const session = await getSession();
	if (!session) unauthorized();

	try {
		return await fn(session);
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error(errorMessage);
	}
}
