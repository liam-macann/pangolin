import fs from 'node:fs';
import path from 'node:path';

import './../envConfig.ts';

import { db } from './../src/db';

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
