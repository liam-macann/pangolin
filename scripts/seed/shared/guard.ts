import { sql } from 'drizzle-orm';

import { type SeedDatabase } from './context';

/** Comment that a database must carry before it may be reset and seeded */
export const SEEDABLE = 'seedable';

/** Reads the name and comment of the connected database. */
async function describeDatabase(tx: SeedDatabase) {
	const [database] = await tx
		.select({
			name: sql<string>`datname`,
			comment: sql<string | null>`shobj_description(oid, 'pg_database')`,
		})
		.from(sql`pg_database`)
		.where(sql`datname = current_database()`);

	if (!database) throw new Error('Unable to determine the current database');
	return database;
}

/** Refuses any database that has not been marked as safe to reset and seed.
 *  @throws When the connected database is not marked. */
export async function assertSeedable(tx: SeedDatabase) {
	const { name, comment } = await describeDatabase(tx);

	if (comment?.trim() === SEEDABLE) return;

	throw new Error(
		[
			`Database ${name} is not marked as seedable: nothing was changed.`,
			``,
			'If this is a development database, mark it once with:',
			`  COMMENT ON DATABASE "${name.replaceAll('"', '""')}" IS '${SEEDABLE}';`,
		].join('\n'),
	);
}
