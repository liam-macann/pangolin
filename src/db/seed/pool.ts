import { type NumberOrRange } from '@faker-js/faker';

import { type SeedOptions } from './shared/context';

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
export function assertHistory(history: number[], versions?: NumberOrRange) {
	if (history.some(len => shortfall(len, versions))) {
		throw new Error('Version history cannot be recut once seeded');
	}
}

/** What the pools of one seeding run share */
export interface PoolInit<Ctx> {
	/** Resolves a requested count before creating context or dependencies. */
	resolveNumberOrRange: (count: NumberOrRange) => number;

	/** Resolves what every seeder writes with, once the first has rows to seed. */
	context: () => Promise<Ctx>;

	/** Wraps each write action with a callback. */
	run: <T>(task: () => Promise<T>) => Promise<T>;
}

/** Binds pools to one seeding run.
 *  @returns A function that remembers the seeded rows of an entity. */
export const createPool = <Ctx>({ context, run, resolveNumberOrRange }: PoolInit<Ctx>) =>
	/** @param validate Rejects options that the rows already seeded cannot satisfy. */
	function pool<Row extends { id: string }, Opts extends SeedOptions>(
		seeder: (ctx: Ctx, options?: Opts) => Promise<Row[]>,
		validate?: (rows: Row[], options?: Opts) => void,
	) {
		const rows = new Map<string, Row>();
		let initialized = false;

		/** Adds new logical entities, each with its own history where versioned. */
		const add = async (opts?: Opts) => {
			const { overrides } = opts ?? {};

			// If given an override array, default to row count matching length
			const requested = opts?.count ?? (Array.isArray(overrides) ? overrides.length : undefined);
			const count = requested === undefined ? undefined : resolveNumberOrRange(requested);

			// A resolved zero seeds nothing, so builds no context or dependencies
			if (count === 0) {
				initialized = true;
				return [];
			}

			const batch = await run(async () => seeder(await context(), opts && { ...opts, count }));
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
				if (opts.overrides) throw new Error('Overrides cannot change rows once seeded');
				const count = shortfall(rows.size, opts.count);
				if (count !== undefined) await add({ ...opts, count });
			}

			return list();
		};

		// A copy of the pool, so that a caller cannot mutate it
		/** Access all seeded values from the entity pool, without an operation. */
		const list = () => [...rows.values()];

		/** Whether the caller explicitly requested zero of this entity: seeded, yet empty. */
		const declined = () => initialized && rows.size === 0;

		return { add, ensure, list, declined };
	};
