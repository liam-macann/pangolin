import { type AnyColumn, type SQL, sql } from 'drizzle-orm';

import { type AuthTransaction } from '@/db';
import * as schema from '@/db/schema';

import { type Enum } from './utils/drizzle';

type Sequence = {
	userId: string;
	namespace: Enum<typeof schema.namespaceEnum>;
	partition?: string | null | SQL<string | null>;
};

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

/** Atomically allocates the next value within a document series and partition */
export async function allocateSequence(
	/** This must strictly be a transaction context to ensure gapless sequencing */
	tx: AuthTransaction,
	{ userId, namespace, partition = null }: Sequence,
) {
	const [{ count }] = await tx
		.insert(schema.sequencer)
		.values({ userId, namespace, partition, count: 1 })
		.onConflictDoUpdate({
			target: [schema.sequencer.userId, schema.sequencer.namespace, schema.sequencer.partition],
			set: { count: increment(schema.sequencer.count) },
		})
		.returning({ count: schema.sequencer.count });

	return count;
}
