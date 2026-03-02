import { eq, getColumns } from 'drizzle-orm';
import { cacheLife } from 'next/cache';

import { getSession } from '@/auth';
import { db } from '@/db';
import { supportedTimezones, timezones } from '@/db/schema';
import { crypto } from '@/lib/encrypt';

export async function getCurrencies() {
	'use cache';
	cacheLife('max');

	return await db.query.currencies.findMany({
		where: { isActive: { eq: true } },
		columns: { isActive: false, minorUnit: false },
		orderBy: { iso: 'asc', name: 'asc' },
	});
}

export async function getTimezones() {
	'use cache';
	cacheLife('max');

	return await db
		.select(getColumns(timezones))
		.from(timezones)
		.innerJoin(supportedTimezones, eq(timezones.name, supportedTimezones.name));
}

export async function getUser() {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	const user = await db.query.users.findFirst({ where: { id: session.user.id } });
	if (!user) throw new Error('User not found');

	return user;
}

/** Gets the active configuration for the authenticated user */
export async function getUserConfig() {
	const session = await getSession();
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
					address: true,
					configTaxes: {
						with: { taxes: { columns: { id: false, userId: false } } },
						orderBy: { order: 'asc' },
					},
				},
				orderBy: { validFrom: 'desc' },
			})
			.then(async res => {
				if (!res) return;

				const [paymentDetails, registrationNumber, streetAddress] = await Promise.all([
					res.paymentDetails && vault.decrypt(...res.paymentDetails),
					res.registrationNumber && vault.decrypt(...res.registrationNumber),
					res.address?.streetAddress && vault.decrypt(...res.address.streetAddress),
				]);

				return {
					...res,
					paymentDetails: paymentDetails?.map(v => {
						const [label, value] = v.split(/: (.*)/s);
						return { label, value };
					}),
					registrationNumber: registrationNumber?.map(v => {
						const [label, value] = v.split(/: (.*)/s);
						return { label, value };
					}),
					address: res.address && {
						...res.address,
						streetAddress,
					},
				};
			})
			.then(res => {
				if (!res) return;
				return { ...res, taxes: res.configTaxes.map(i => i.taxes) };
			});

		vault.destroy();

		// If user has no current config
		if (!res) throw new Error('User has no current valid config.');

		return res;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
