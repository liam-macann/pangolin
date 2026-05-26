import { eq, getColumns } from 'drizzle-orm';
import { cacheLife } from 'next/cache';
import { notFound, unstable_rethrow } from 'next/navigation';
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

	if (!user) notFound();
	return user;
}

/** Gets the active configuration for the authenticated user */
export const getUserConfig = cache(async function getUserConfig() {
	try {
		return await withRLS(async (db, session) => {
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

			// If user has no current config
			if (!res) notFound();

			const vault = await crypto(session.user.id);
			const decrypted = await vault.decryptObject(res);
			vault.destroy();

			return {
				...decrypted,
				paymentDetails: decrypted.paymentDetails?.map(v => {
					const [label, value] = v.split(/: (.*)/s);
					return { label, value };
				}),
				tradingNumber: decrypted.tradingNumber?.map(v => {
					const [label, value] = v.split(/: (.*)/s);
					return { label, value };
				}),

				taxes: decrypted.configTaxes.map(i => i.taxes),
			};
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
});
