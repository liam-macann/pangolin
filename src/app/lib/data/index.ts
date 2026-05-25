import { eq, getColumns } from 'drizzle-orm';
import { cacheLife } from 'next/cache';
import { cache } from 'react';

import { crypto } from '@/lib/encrypt';
import { db, withRLS } from '@/db';
import { supportedTimezones, timezones } from '@/db/schema';

export async function getCurrencies() {
	'use cache';
	cacheLife('max');

	db.query.currencies.findMany({
		where: { isActive: { eq: true } },
		columns: { isActive: false, minorUnit: false },
		orderBy: { iso: 'asc', name: 'asc' },
	});
}

export async function getTimezones() {
	'use cache';
	cacheLife('max');

	db.select(getColumns(timezones))
		.from(timezones)
		.innerJoin(supportedTimezones, eq(timezones.name, supportedTimezones.name));
}

export async function getUser() {
	const user = await withRLS(async (db, session) =>
		db.query.users.findFirst({ where: { id: session.user.id } }),
	);
	if (!user) throw new Error('User not found');

	return user;
}

/** Gets the active configuration for the authenticated user */
export const getUserConfig = cache(async function getUserConfig() {
	try {
		const res = await withRLS(async (db, session) => {
			const vault = await crypto(session.user.id);
			const res = await db.query.config.findFirst({
				where: {
					userId: session.user.id,
					validTo: { isNull: true },
				},
				with: {
					user: true,
					address: true,
					configTaxes: {
						with: { taxes: { columns: { userId: false } } },
						orderBy: { order: 'asc' },
					},
				},
				orderBy: { validFrom: 'desc' },
			});

			if (!res) throw new Error('Config not found');

			const decrypted = await vault.decryptObject(res);
			vault.destroy();

			return {
				...decrypted,
				paymentDetails: decrypted.paymentDetails?.map(v => {
					const [label, value] = v.split(/: (.*)/s);
					return { label, value };
				}),
				registrationNumber: decrypted.registrationNumber?.map(v => {
					const [label, value] = v.split(/: (.*)/s);
					return { label, value };
				}),

				taxes: decrypted.configTaxes.map(i => i.taxes),
			};
		});

		// If user has no current config
		if (!res) throw new Error('User has no current valid config.');

		return res;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
});
