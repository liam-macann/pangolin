import { eq, getColumns, type RelationsFilter } from 'drizzle-orm';
import { cacheLife } from 'next/cache';
import { notFound, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

import { type Config } from '@/api/dto/config';
import { withVault } from '@/lib/encrypt';
import { db, withRLS } from '@/db';
import { type relations } from '@/db/relations';
import { supportedTimezones, timezones } from '@/db/schema';

export async function getTimezones() {
	'use cache';
	cacheLife('max');

	return db
		.select(getColumns(timezones))
		.from(timezones)
		.innerJoin(supportedTimezones, eq(timezones.name, supportedTimezones.name));
}

/** Fetches a config record
 *
 * - `fetchConfig()` → the active configuration
 * - `fetchConfig(id)` → a specific (possibly historical) version
 */
export const fetchConfig = cache(async function fetchConfig(id?: string): Promise<Config> {
	try {
		const filter: RelationsFilter<typeof relations.config, typeof relations> = id
			? { id: { eq: id } }
			: { validTo: { isNull: true } };

		return await withRLS(async (db, session) => {
			const res = await db.query.config.findFirst({
				where: { ...filter, userId: { eq: session.user.id } },
				columns: {
					validFrom: false,
					validTo: false,
					userId: false,
					addressId: false,
				},
				with: {
					address: true,
					configTaxes: {
						with: { taxes: { columns: { userId: false } } },
						orderBy: { order: 'asc' },
					},
				},
				orderBy: { validFrom: 'desc' },
			});

			if (!res) notFound();

			return withVault(async vault => {
				const { configTaxes, ...decrypted } = await vault.decryptObject(res);
				return { ...decrypted, taxes: configTaxes.map(i => i.taxes) };
			});
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
});
