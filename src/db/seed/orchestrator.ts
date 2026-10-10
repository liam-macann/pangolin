import { base as baseLocale, en, Faker, type NumberOrRange } from '@faker-js/faker';
import { once } from 'es-toolkit/function';

import { seedClients } from './entities/clients';
import { seedConfig } from './entities/config';
import { seedKeychain } from './entities/encrypt';
import { seedInvoices } from './entities/invoices';
import { seedTaxes } from './entities/taxes';
import { type SeedContext, type SeedOptions, type VersionOptions } from './shared/context';
import { assertSeedable } from './shared/guard';

/** Options for each entity that a full seed fills in. */
export interface EntityOptions {
	config?: Parameters<typeof seedConfig>[1];
	clients?: Parameters<typeof seedClients>[1];
	invoices?: Parameters<typeof seedInvoices>[1];
	taxes?: Parameters<typeof seedTaxes>[1];
}

/** Returns what is missing, rejecting requests whose upper bound is already exceeded. */
function shortfall(have: number, want?: NumberOrRange) {
	if (want === undefined) return;
	const { min, max } = typeof want === 'number' ? { min: want, max: Infinity } : want;

	if (have > max) throw new Error(`Already seeded ${have}: more than caller asked for`);
	if (have >= min) return;

	if (typeof want === 'number') return min - have;
	return { min: min - have, max: max - have };
}

/** @throws When a seeded history is not as long as asked for, as its periods are already cut. */
function assertHistory(history: number[], versions?: NumberOrRange) {
	if (history.some(len => shortfall(len, versions))) {
		throw new Error('Version history cannot be recut once seeded');
	}
}

export interface SeederInit extends Omit<SeedContext, 'encrypt' | 'faker'> {
	/** Makes the data reproducible. Defaults to the user, so that parallel users never collide PKs. */
	seed?: number | number[];
}

/** Binds the seeders to the history of one existing user, who must not have any data yet.
 *  @remarks Each entity resolves and seeds dependencies, unless they already exist
 *  @throws When the user already has data on first use, or the database is not marked as seedable. */
export function createSeeder({ seed, ...base }: SeederInit) {
	// A private instance avoids setting global Faker seed
	const faker = new Faker({ locale: [en, baseLocale] });
	faker.seed(seed ?? Array.from(base.userId, char => char.charCodeAt(0)));

	/** @returns A SeedContext object */
	const context = once(async (): Promise<SeedContext> => {
		await assertSeedable(base.tx);
		return { ...base, faker, encrypt: await seedKeychain(base.tx, base.userId) };
	});

	/** Remembers the seeded rows of an entity.
	 *  @param validate Rejects options that the rows already seeded cannot satisfy. */
	function pool<Row extends { id: string }, Opts extends SeedOptions>(
		seeder: (ctx: SeedContext, options?: Opts) => Promise<Row[]>,
		validate?: (rows: Row[], options?: Opts) => void,
	) {
		const rows = new Map<string, Row>();
		let initialized = false;

		/** Adds new logical entities, each with its own history where versioned. */
		const add = async (opts?: Opts) => {
			const count = opts?.count && faker.helpers.rangeToNumber(opts.count);

			// Prevents building dependencies if no entities were requested
			if (count === 0) {
				initialized = true;
				return [];
			}

			const batch = await seeder(await context(), opts && { ...opts, count });
			batch.forEach(row => void rows.set(row.id, row));
			initialized = true;
			return batch;
		};

		/** Seeds only what is missing: a first batch, or the shortfall on a requested pool size.
		 *  @throws If an entity cannot be reseeded to meet requested conditions. */
		const ensure = async (opts?: Opts) => {
			validate?.([...rows.values()], opts);
			if (!initialized) await add(opts);
			else if (opts) {
				const count = shortfall(rows.size, opts.count);
				if (count !== undefined) await add({ ...opts, count });
			}

			return list();
		};

		/** A copy of the pool, so that a caller cannot mutate it */
		const list = () => [...rows.values()];

		/** Whether the caller asked for none of this entity: seeded, yet empty */
		const declined = () => initialized && rows.size === 0;

		return { add, ensure, list, declined };
	}

	const taxes = pool(seedTaxes);

	const clients = pool(seedClients, (rows, options) => {
		const history = rows.map(client => client.versions.length);
		assertHistory(history, options?.versions);
	});

	/** The one config of the user, pooled as the versions of its history. */
	const config = pool(
		async (ctx, options?: SeedOptions & VersionOptions) =>
			seedConfig(ctx, options, { taxes: await taxes.ensure() }),

		(rows, options) => {
			const { versions = 1 } = options ?? {};
			if ((typeof versions === 'number' ? versions : versions.min) < 1)
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

	/** Public handles for each entity */
	const handles = {
		taxes: taxes.add,
		config: config.ensure,
		clients: clients.add,
		invoices: invoices.add,
	};

	/** Ensure entity options are inherited from public interface, not the pooler */
	const entities: {
		[K in keyof typeof handles]: (options?: EntityOptions[K]) => ReturnType<(typeof handles)[K]>;
	} = handles;

	return { ...entities, all };
}
