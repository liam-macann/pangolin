import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { inject } from 'vitest';

import { relations } from '@/db/relations';

/** Indicates a Drizzle instance that points to a disposable database */
type TestDB = ReturnType<typeof drizzle<typeof relations>>;

/** The transaction object handed into a `TestDB.transaction()` callback */
export type TestTX = Parameters<Parameters<TestDB['transaction']>[0]>[0];

/** Boots an in-memory Postgres (PGlite) instance with every migration in `drizzle/` applied */
export async function createTestDB(): Promise<TestDB> {
	const client = await PGlite.create({
		loadDataDir: new Blob([await readFile(inject('pgliteTemplatePath'))]),
	});
	return drizzle({ client, relations });
}

/** Creates a PGlite data directory containing the complete application schema. */
export async function createMigratedTestTemplate(): Promise<Blob> {
	const db = drizzle({ relations });

	try {
		await applyMigrations(db);
		return await db.$client.dumpDataDir('none');
	} finally {
		await db.$client.close();
	}
}

// Drizzle `migrate()` breaks without `--> statement-breakpoint`
// This bypassses, and manually executes each statement
export async function applyMigrations(db: TestDB) {
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
