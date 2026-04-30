import { eq, getColumns } from 'drizzle-orm';
import { cacheLife } from 'next/cache';

import { crypto } from '@/lib/encrypt';
import { withRLS } from '@/db';
import { supportedTimezones, timezones } from '@/db/schema';

import { getSession } from '@/auth';

export async function getCurrencies() {
	'use cache';
	cacheLife('max');

	return await withRLS(async db =>
		db.query.currencies.findMany({
			where: { isActive: { eq: true } },
			columns: { isActive: false, minorUnit: false },
			orderBy: { iso: 'asc', name: 'asc' },
		}),
	);
}

export async function getTimezones() {
	'use cache';
	cacheLife('max');

	return await withRLS(async db =>
		db
			.select(getColumns(timezones))
			.from(timezones)
			.innerJoin(supportedTimezones, eq(timezones.name, supportedTimezones.name)),
	);
}

export async function getUser() {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	const user = await withRLS(async db =>
		db.query.users.findFirst({ where: { id: session.user.id } }),
	);
	if (!user) throw new Error('User not found');

	return user;
}

/** Gets the active configuration for the authenticated user */
export async function getUserConfig() {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	const vault = await crypto(session.user.id);

	try {
		const res = await withRLS(async db =>
			db.query.config
				.findFirst({
					where: {
						userId: session.user.id,
						validTo: undefined,
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
				})
				.then(async res => {
					if (!res) return;

					const decrypted = await vault.decryptObject(res);

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
					};
				})
				.then(res => {
					if (!res) return;
					return { ...res, taxes: res.configTaxes.map(i => i.taxes) };
				}),
		);

		// If user has no current config
		if (!res) throw new Error('User has no current valid config.');

		return res;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	} finally {
		vault.destroy();
	}
}
