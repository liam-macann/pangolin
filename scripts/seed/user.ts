import { faker } from '@faker-js/faker';

import { type Transaction } from './../../src/db';
import * as schema from './../../src/db/schema';

export async function seedUser(tx: Transaction) {
	const userId = faker.string.uuid();

	await tx.insert(schema.users).values({
		id: userId,
		name: faker.person.fullName(),
		email: faker.internet.email(),
		emailVerified: false,
	});

	return userId;
}
