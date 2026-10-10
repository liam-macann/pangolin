import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { parse } from 'pg-connection-string';
import { Temporal } from 'temporal-polyfill';

import { relations } from '@/db/relations';
import * as tables from '@/db/schema';

import { createSeeder } from './seed/orchestrator';
import { resetUser } from './seed/reset';
import { assertSeedable } from './seed/shared/guard';

process.on('uncaughtException', error => {
	// Drizzle error message is the whole query, so print the cause
	const { message } = error.cause instanceof Error ? error.cause : error;

	// Continuation lines are indented to line up with the text after the cross
	const lines = message.replaceAll('\n', '\n   ');

	console.error(styleText('red', `\n×  ${lines}\n`, { stream: process.stderr }));
	process.exit(1);
});

if (process.env.NODE_ENV) throw new Error('Seeding may not be executed within application');
if (!process.stdin.isTTY) throw new Error('Seeding must be confirmed from an interactive terminal');

const [userId] = process.argv.slice(2);

if (userId === undefined)
	throw new Error('You must provide a UUID to scope seed to an existing account');

// Superuser connection, which bypasses RLS
const db = drizzle({ relations, client: new Pool({ connectionString: process.env.DATABASE_URL }) });

// Fails on any database that was not marked as seedable, production included
await assertSeedable(db);

const [user] = await db
	.select({ email: tables.users.email })
	.from(tables.users)
	.where(eq(tables.users.id, userId));

if (!user) throw new Error(`User ${userId} not found`);

const { host, database } = parse(process.env.DATABASE_URL ?? '');
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const answer = await terminal.question(
	[
		`This overwrites all data for ${user.email}.`,
		`  Host      ${host}`,
		`  Database  ${database}`,
		``,
		'Type their email to continue: ',
	].join('\n'),
);
terminal.close();

if (answer.trim() !== user.email) throw new Error("Confirmation didn't match: nothing was changed");

// Replaces all data of the user with a seeded history
const { invoices } = await db.transaction(async tx => {
	await resetUser(tx, userId);

	// History covers the three calendar years before this one, up to the present
	const now = Temporal.Now.zonedDateTimeISO('UTC');
	const from = now.subtract({ years: 3 }).with({ month: 1, day: 1 }).startOfDay();

	return createSeeder({ tx, userId, from: from.toInstant(), to: now.toInstant() }).all();
});

console.log(`Seeded ${invoices.length} invoices successfully.`);

await db.$client.end();
