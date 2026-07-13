import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { escapeLiteral } from 'pg';

import { currencies as data } from '@/lib/utils/currencies';

if (!data.length)
	throw new Error('Currency list is empty. Aborting migration generation to prevent invalid SQL.');

const currencies = [...data].sort((a, b) => a.iso.localeCompare(b.iso));

const migrationsDir = path.resolve('drizzle');
if (!fs.existsSync(migrationsDir))
	throw new Error(`Migration directory not found: ${migrationsDir}`);

const before = new Set(fs.readdirSync(migrationsDir));

// Generate migration and pipe output directly to console
execFileSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--custom', '--name=sync_currencies'], {
	stdio: 'inherit',
});

// Find the generated file
const created = fs
	.readdirSync(migrationsDir)
	.filter(item => item.endsWith('_sync_currencies') && !before.has(item));

if (created.length !== 1)
	throw new Error(
		`Expected exactly one new sync_currencies migration, but found ${created.length || 'none'}`,
	);

const migrationPath = path.join(migrationsDir, created[0], 'migration.sql');

/** Identity tag to enable SQL syntax highlighting */
const sql = String.raw;

const values = currencies
	.map(({ iso, name }) => `\t(${escapeLiteral(iso)}, ${escapeLiteral(name)}, true)`)
	.join(',\n');

const isos = currencies.map(({ iso }) => escapeLiteral(iso)).join(', ');

fs.writeFileSync(
	migrationPath,
	sql`
-- Sync the currency reference table with the app's currency list (@/lib/utils/currencies.ts)

-- Insert missing currencies and update renamed ones.
INSERT INTO "currency" ("iso", "name", "is_active")
VALUES ${values}
ON CONFLICT ("iso") DO UPDATE
SET "name" = EXCLUDED."name";--> statement-breakpoint

-- Mark codes in the list active and everything else inactive.
UPDATE "currency"
SET "is_active" = ("iso" IN (${isos}));--> statement-breakpoint

-- Remove inactive codes, unless a config still references them.
DELETE FROM "currency"
WHERE "is_active" = false
  AND NOT EXISTS (
   	SELECT 1 FROM "config" WHERE "config"."currency" = "currency"."iso"
  );
`,
);

console.log('Wrote currency sync migration');
