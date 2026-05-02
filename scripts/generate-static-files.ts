import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { relations } from './../src/db/relations.ts';

import './../env-config.ts';

export const db = drizzle({
	client: neon(process.env.DATABASE_URL as string),
	relations,
});

const output = path.join(__dirname, '../src/app/lib/data/currencies.json');

async function generateCurrencies() {
	if (fs.existsSync(output)) {
		console.log('Currency file already exists: bypassing fetch');
		return;
	}

	console.log('Generating static currency file...');

	try {
		const currencies = await db.query.currencies.findMany({
			where: { isActive: { eq: true } },
			columns: { isActive: false, minorUnit: false },
			orderBy: { iso: 'asc', name: 'asc' },
		});

		fs.writeFileSync(output, JSON.stringify(currencies, null, 2));
	} catch (error) {
		console.error('Error generating currencies:', error);
		process.exit(1); // Fail build if this script fails
	}
}

generateCurrencies();
