import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';

import { relations } from '@/db/relations';

/** Indicates a Drizzle instance that points to a disposable database */
// PgliteDatabase does not match production driver, and so types are not compatible
export interface TestDB extends ReturnType<typeof drizzle<typeof relations>> {}

type TestTXBase = Parameters<Parameters<TestDB['transaction']>[0]>[0];
/** The transaction object handed into a `TestDB.transaction()` callback */
export interface TestTX extends TestTXBase {} // Interface is collapsed in type hints

/** Makes each transaction opened on `connection` check its deferred constraints on exit.
 *  @remarks {@link TestTX} is a savepoint, not a fresh transaction, so never reaches commit checks. */
export function checkDeferredConstraints(db: TestTX): TestTX {
	const transaction = <T>(callback: (tx: TestTX) => Promise<T>) =>
		db.transaction(async tx => {
			const result = await callback(tx);
			await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
			await tx.execute(sql`SET CONSTRAINTS ALL DEFERRED`); // Reset: SET CONSTRAINTS outlives savepoint

			return result;
		});

	// Delegates everything else to input through the prototype chain
	return Object.assign(Object.create(db), { transaction });
}

/** Boots an in-memory Postgres (PGlite) instance with every migration in `drizzle/` applied */
export async function createTestDB(): Promise<TestDB> {
	const db = drizzle({ relations, connection: { relaxedDurability: true } });
	await applyMigrations(db);
	return db;
}

// Drizzle `migrate()` breaks without `--> statement-breakpoint`
// This bypasses, and manually executes each statement
async function applyMigrations(db: TestDB) {
	// Migrations run as neondb_owner in production, so tables created here inherit that ownership
	await db.execute(sql`CREATE ROLE neondb_owner SUPERUSER;`);
	await db.execute(sql`SET ROLE neondb_owner;`);

	const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' });

	for (const migration of migrations) {
		for (const statement of migration.sql) await db.$client.exec(statement);
	}

	await db.execute(sql`SET ROLE authenticated;`);
}
