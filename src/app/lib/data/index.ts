import { headers } from 'next/headers';
import { getSession } from '@/auth';
import { db } from '@/db';
import { crypto } from '@/lib/encrypt';

export async function getUser() {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	const user = await db.query.users.findFirst({ where: { id: session.user.id } });
	if (!user) throw new Error('User not found');

	return user;
}

/** Gets the active configuration for the authenticated user */
export async function getUserConfig() {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	try {
		const vault = await crypto(session.user.id);

		const res = await db.query.config
			.findFirst({
				where: {
					userId: session.user.id,
					validTo: undefined,
				},
				with: {
					user: true,
					taxes: { orderBy: { id: 'asc' } },
				},
				orderBy: { validFrom: 'desc' },
			})
			.then(
				async res =>
					res && {
						...res,
						paymentDetails:
							res.paymentDetails &&
							(await vault.decrypt(...res.paymentDetails)).map(v => {
								const [label, value] = v.split(': ');
								return { label, value };
							}),
					},
			);

		vault.destroy();

		// If user has no current config
		if (!res) throw new Error('User has no current valid config.');

		return res;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
