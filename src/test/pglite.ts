import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';

import { relations } from '@/db/relations';

/** Indicates a Drizzle instance that points to a disposable database */
export type TestDB = ReturnType<typeof drizzle<typeof relations>>;

/** The transaction object handed into a `TestDB.transaction()` callback */
export type TestTx = Parameters<Parameters<TestDB['transaction']>[0]>[0];

/** Boots an in-memory Postgres (PGlite) instance with every migration in `drizzle/` applied */
export async function createTestDb(): Promise<TestDB> {
	const db = drizzle({ relations });

	// Migrations run as neondb_owner in production, so tables created here inherit that ownership
	await db.$client.exec('CREATE ROLE neondb_owner SUPERUSER; SET ROLE neondb_owner;');
	await applyMigrations(db);

	return db;
}

/** Runs each migration statement via `.exec()` (simple query protocol) instead of drizzle's
 *  `migrate()`, since one migration batches multiple DDL statements per breakpoint — fine for
 *  Postgres's simple protocol, rejected by prepared-statement execution. */
async function applyMigrations(db: TestDB) {
	const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' });

	for (const migration of migrations) {
		for (const statement of migration.sql) {
			await db.$client.exec(statement);
		}
	}
}
