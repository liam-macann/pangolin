import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';

import { relations } from '@/db/relations';

/** Indicates a Drizzle instance that points to a disposable database */
type TestDB = ReturnType<typeof drizzle<typeof relations>>;

/** The transaction object handed into a `TestDB.transaction()` callback */
export type TestTX = Parameters<Parameters<TestDB['transaction']>[0]>[0];

/** Boots an in-memory Postgres (PGlite) instance with every migration in `drizzle/` applied */
export async function createTestDB(): Promise<TestDB> {
	const db = drizzle({ relations });
	await applyMigrations(db);
	return db;
}

// Drizzle `migrate()` breaks without `--> statement-breakpoint`
// This bypassses, and manually executes each statement
async function applyMigrations(db: TestDB) {
	// Migrations run as neondb_owner in production, so tables created here inherit that ownership
	await db.execute(sql`CREATE ROLE neondb_owner SUPERUSER;`);
	await db.execute(sql`SET ROLE neondb_owner;`);

	const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' });

	for (const migration of migrations) {
		for (const statement of migration.sql) {
			await db.$client.exec(statement);
		}
	}

	await db.execute(sql`SET ROLE authenticated;`);
}
