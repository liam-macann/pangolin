import { faker } from '@faker-js/faker';

import * as schema from '@/db/schema';

import { type Transaction } from '@/scripts/db';

export async function seedTaxes(tx: Transaction, userId: string) {
	const taxes = ['GST', 'VAT', 'EXP', 'LCT', 'WET'].map(name => ({
		id: faker.string.uuid(),
		userId,
		name,
		rate: faker.number.float({ min: 0.01, max: 0.5, fractionDigits: 4 }),
	}));

	await tx.insert(schema.taxes).values(taxes);

	return taxes;
}
