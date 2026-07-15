import { faker } from '@faker-js/faker';

import { type Transaction } from '@/db';
import * as schema from '@/db/schema';

import { seedAddress } from './address';
import { type SeedCrypto } from './encrypt';
import { generateScdIntervals, type ScdVersion } from './utils';

export type ClientRecord = {
	clientId: string;
	versions: ScdVersion[];
};

async function seedClientDataVersion(
	tx: Transaction,
	userId: string,
	clientId: string,
	version: ScdVersion,
	crypto: SeedCrypto,
) {
	const addrId = await seedAddress(tx, userId, crypto);

	const name = faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.8 }) ?? null;
	const organization =
		faker.helpers.maybe(() => faker.company.name(), { probability: 0.6 }) ?? null;

	await tx.insert(schema.clientData).values({
		id: version.id,
		userId,
		clientId,
		name: name ?? (organization === null ? faker.person.fullName() : null),
		organization,
		email: faker.internet.email(),
		notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? null,
		addressId: addrId,
		validFrom: version.validFrom,
		validTo: version.validTo,
	});
}

export async function seedClients(
	tx: Transaction,
	userId: string,
	yearCounts: Record<number, number>,
	crypto: SeedCrypto,
): Promise<ClientRecord[]> {
	const records: ClientRecord[] = [];
	const count = faker.number.int({ min: 8, max: 42 });

	for (let i = 0; i < count; i++) {
		const clientId = faker.string.uuid();

		await tx.insert(schema.clients).values({
			id: clientId,
			userId,
			isFavorite: faker.datatype.boolean({ probability: 0.2 }),
			isDeleted: faker.datatype.boolean({ probability: 0.1 }),
		});

		const versionCount = faker.number.int({ min: 1, max: 3 });
		const years = Object.keys(yearCounts).map(Number).sort();
		const versions: ScdVersion[] = generateScdIntervals(
			new Date(years[0] - 2, 0, 1),
			versionCount,
		).map(interval => ({ id: faker.string.uuid(), ...interval }));

		for (const version of versions) {
			await seedClientDataVersion(tx, userId, clientId, version, crypto);
		}

		records.push({ clientId, versions });
	}

	return records;
}
