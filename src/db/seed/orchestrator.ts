import { base as baseLocale, en, Faker } from '@faker-js/faker';
import { once } from 'es-toolkit/function';

import { seedClients } from './entities/clients';
import { seedConfig } from './entities/config';
import { seedKeychain } from './entities/encrypt';
import { seedInvoices } from './entities/invoices';
import { seedTaxes } from './entities/taxes';
import { assertHistory, createPool, type PoolInit } from './pool';
import { type SeedContext } from './shared/context';
import { assertSeedable } from './shared/guard';

/** Options for each entity that a full seed fills in. */
export interface EntityOptions {
	config?: Parameters<typeof seedConfig>[1];
	clients?: Parameters<typeof seedClients>[1];
	invoices?: Parameters<typeof seedInvoices>[1];
	taxes?: Parameters<typeof seedTaxes>[1];
}

export interface SeederInit extends Omit<SeedContext, 'encrypt' | 'faker'> {
	/** Wraps each write action with a callback. */
	run?: PoolInit<SeedContext>['run'];

	/** Makes the data reproducible. Defaults to the user, so that parallel users never collide PKs. */
	seed?: number | number[];
}

/** Binds the seeders to the history of one existing user, who must not have any data yet.
 *  @remarks Each entity resolves and seeds dependencies, unless they already exist
 *  @throws When the user already has data on first use, or the database is not marked as seedable. */
export function createSeeder({ run = task => task(), seed, ...base }: SeederInit) {
	// A private instance avoids setting global Faker seed
	const faker = new Faker({ locale: [en, baseLocale] });
	faker.seed(seed ?? Array.from(base.userId, char => char.charCodeAt(0)));

	/** @returns A SeedContext object */
	const context = once(async (): Promise<SeedContext> => {
		await assertSeedable(base.tx);
		return { ...base, faker, encrypt: await seedKeychain(base.tx, base.userId) };
	});

	const pool = createPool({
		run,
		context,
		resolveNumberOrRange: count => faker.helpers.rangeToNumber(count),
	});

	const taxes = pool(seedTaxes);

	const clients = pool(seedClients, (rows, options) => {
		const history = rows.map(client => client.versions.length);
		assertHistory(history, options?.versions);
	});

	/** The one config of the user, pooled as the versions of its history. */
	const config = pool(
		async (ctx, options?: EntityOptions['config']) => {
			const { overrides, versions } = options ?? {};
			const listed = [overrides].flat(); // Treat object-root and array-root the same way

			// A shortfall of overrides leaves later versions to fall back on the pool
			const max = typeof versions === 'object' ? versions.max : (versions ?? listed.length);
			const hasEnough = !Array.isArray(overrides) || max <= overrides.length;

			// Taxes are only filled in for a version that lists none of its own
			const needsTaxPool = !hasEnough || listed.some(version => version?.taxes === undefined);

			return seedConfig(ctx, options, {
				taxes: needsTaxPool ? await taxes.ensure() : taxes.list(),
			});
		},

		(rows, options) => {
			const { overrides, versions = 1 } = options ?? {};

			// An empty overrides array is an implicit zero versions count
			const isEmptyOverrides = Array.isArray(overrides) && overrides.length === 0;

			if (isEmptyOverrides || (typeof versions === 'number' ? versions : versions.min) < 1)
				throw new Error('History must contain at least one version');

			if (rows.length > 0) assertHistory([rows.length], options?.versions);
		},
	);

	const invoices = pool(async (ctx, options?: EntityOptions['invoices']) => {
		// An explicitly empty pool is preserved, so cannot be filled in for an invoice to reference
		if (clients.declined())
			throw new Error('Invoices need a client, but seeder was asked for zero');

		return seedInvoices(
			ctx,
			options,
			// Minimal dependencies needed to form an invoice
			{
				configs: await config.ensure({ versions: 1 }),
				clients: await clients.ensure({ count: 1, versions: 1 }),
			},
		);
	});

	/** Fills in missing data, so that every call has seeded history.
	 * @remarks Repeated calls top up to the requested count. */
	const all = async (options?: EntityOptions) => {
		await taxes.ensure(options?.taxes);
		await config.ensure(options?.config);
		await clients.ensure(options?.clients);
		const seeded = await invoices.ensure(options?.invoices);

		// Read last, as each entity fills in whichever dependencies it found missing
		return {
			taxes: taxes.list(),
			configs: config.list(),
			clients: clients.list(),
			invoices: seeded,
		};
	};

	return {
		taxes: taxes.add,
		/** Seeded on first use and returned as-is afterwards, as a user has only one config. */
		config: config.ensure,
		clients: clients.add,
		invoices: invoices.add,
		all,
	};
}
