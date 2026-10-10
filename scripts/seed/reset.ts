import { eq, getTableName, is } from 'drizzle-orm';
import { PgTable, type PgUUID } from 'drizzle-orm/pg-core';

import { keychain } from '@/db/schema';
import * as tables from '@/db/schema/data';

import { type SeedDatabase } from './shared/context';
import { assertSeedable } from './shared/guard';

type Owned = PgTable & { userId: PgUUID };

/** Every table owned by a userId tenant: all tables of the data schema.
 *  @remarks Auth and reference tables live in other schema modules, so a reset leaves them alone. */
export const owned = Object.values(tables).filter(entity => is(entity, PgTable)) satisfies Owned[];

/** Deletes all data owned by one user, leaving their account and every other user untouched.
 *  @remarks Runs as a single statement, so the deletes need no particular order.
 *  @throws When the database is not marked as seedable. */
export async function resetUser(tx: SeedDatabase, userId: string) {
	await assertSeedable(tx);

	const deletes = owned.map(table =>
		tx.$with(`deleted_${getTableName(table)}`).as(tx.delete(table).where(eq(table.userId, userId))),
	);

	await tx
		.with(...deletes)
		.delete(keychain)
		.where(eq(keychain.id, userId));
}
