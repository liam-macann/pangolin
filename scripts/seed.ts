import { faker } from '@faker-js/faker';
import { reset } from 'drizzle-seed';

import * as schema from './../src/db/schema';
import { db } from './db';

// Only pass actual user-data tables to reset — exclude views, reference data, enums, and roles
const {
	timezones,
	currencies,
	supportedTimezones,
	keychain,
	verifications,
	itemsWithTax,
	invoicesWithSum,
	authenticated,
	statusEnum,
	unitEnum,
	colorEnum,
	numberingScheme,
	...tables
} = schema;

import { seedClients } from './seed/clients';
import { seedConfig } from './seed/config';
import { seedKeychain } from './seed/encrypt';
import { seedInvoiceCounters, seedInvoices } from './seed/invoices';
import { seedTaxes } from './seed/taxes';
import { seedUser } from './seed/user';

// Deterministic seed for reproducible data
faker.seed(42);

// Invoice distribution: last 3 complete years with faker-generated counts
const currentYear = new Date().getFullYear();
const yearCounts = Object.fromEntries(
	Array.from({ length: 3 }, (_, i) => [
		currentYear - 3 + i,
		faker.number.int({ min: 40, max: 100 }),
	]),
) as Record<number, number>;
const totalInvoices = Object.values(yearCounts).reduce((a, b) => a + b, 0);

async function main(uuid?: string) {
	if (process.env.NODE_ENV) {
		throw new Error('Database seeding may not be executed within application');
	}

	await db.transaction(async tx => {
		const attachedUser = uuid
			? await tx.query.users.findFirst({
					where: { id: uuid },
					with: { accounts: true, sessions: true },
				})
			: undefined;

		if (uuid && !attachedUser) throw new Error(`User ${uuid} not found`);

		await reset(tx, tables);

		if (attachedUser) {
			await tx.insert(schema.users).values({
				id: attachedUser.id,
				name: attachedUser.name,
				email: attachedUser.email,
				emailVerified: attachedUser.emailVerified,
				image: attachedUser.image,
			});

			await tx.insert(schema.accounts).values(attachedUser.accounts);
			await tx.insert(schema.sessions).values(attachedUser.sessions);
		}

		const userId = attachedUser?.id || (await seedUser(tx));
		const crypto = await seedKeychain(tx, userId);

		const taxes = (await seedTaxes(tx, userId)).map(t => t.id);
		const configs = await seedConfig(tx, userId, taxes, yearCounts, crypto);
		const clients = await seedClients(tx, userId, yearCounts, crypto);

		await seedInvoiceCounters(tx, userId, totalInvoices, yearCounts);
		await seedInvoices(tx, userId, configs, clients, taxes, yearCounts);
	});
}

(async () => {
	const input = process.argv.slice(2)[0];

	if (input === undefined)
		throw new Error(
			'Input UUID to link seeded data to an existing account — else enter explicit "false"',
		);

	await main(input === 'false' ? '' : input);
	console.log(`Seeded ${totalInvoices} invoices successfully.`);
	process.exit(0);
})();
