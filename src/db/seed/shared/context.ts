import { type Faker, type NumberOrRange } from '@faker-js/faker';
import { type PgAsyncDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type Temporal } from 'temporal-polyfill';

import { type Encrypted } from '@/lib/encrypt';
import { type PartialDeep, type Simplify } from '@/lib/utils/type';
import { type relations } from '@/db/relations';

/** Any Postgres connection or transaction, regardless of driver */
export type SeedDatabase = PgAsyncDatabase<PgQueryResultHKT, typeof relations>;

/** Encrypts a value with the data key of one user */
export type Encrypt = (value: string) => Encrypted;

/** Values a caller can override on a seeded entity. */
export type Overrides<Shape> = Simplify<PartialDeep<Shape, { recurseIntoArrays: false }>>;

/** What every seeder accepts to vary its output */
export type SeedOptions<Shape = unknown> = {
	/** How many logical entities to seed, overriding the default. */
	count?: NumberOrRange;
	/** Fixes seeded values, in the shape of the DTO where it exposes them, else of the column.
	 * @remarks An array overrides by insertion position; an object overrides every entity. */
	overrides?: Overrides<Shape> | Overrides<Shape>[];
};

/** Controls the SCD history of each versioned logical entity. */
export type VersionOptions = {
	/** How many versions to create per entity. */
	versions?: NumberOrRange;
};

/** Everything a seeder needs to write data for one user */
export type SeedContext = {
	tx: SeedDatabase;
	userId: string;

	/** Encrypts with the data key of the user */
	encrypt: Encrypt;

	/** Source of all random data, scoped to one seeder. */
	faker: Faker;

	/** Start of the seeded history */
	from: Temporal.Instant;
	/** End of the seeded history: nothing is dated after this */
	to: Temporal.Instant;
};
