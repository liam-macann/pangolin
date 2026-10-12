import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { createDocument } from './document';
import { documentBuilder } from './tests/builders';

const getDocument = async (id: string) => {
	const res = await withRLS(async (db, session) =>
		db.query.documents.findFirst({
			where: { id, userId: session.user.id },
			with: { items: { with: { taxes: true }, orderBy: { order: 'asc' } } },
		}),
	);

	assert(res, 'Expected a document at the supplied ID');
	return res;
};

describe('createDocument', () => {
	test('Associates a document with inserted line items', async ({ session, seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const { id } = await createDocument(
			documentBuilder({
				clientDataId: client.versions[0].id,
				items: [{ label: 'Consulting services', quantity: 2 }, { label: 'Hosting' }],
			}),
		);

		await expect(getDocument(id)).resolves.toMatchObject({
			userId: session.user.id,
			items: [{ label: 'Consulting services', quantity: '2.00' }, { label: 'Hosting' }],
		});
	});

	test('References the active config version', async ({ seed }) => {
		const [superseded, active] = await seed.config({ versions: 2 });
		expect(superseded.validTo, 'Expected first config to be superseded').not.toBeNull();
		expect(active.validTo, 'Expected last config to be valid').toBeNull();

		const [client] = await seed.clients({ count: 1, versions: 1 });

		const { id } = await createDocument(documentBuilder({ clientDataId: client.versions[0].id }));

		await expect(getDocument(id)).resolves.toMatchObject({ configId: active.id });
	});

	test('Links items to taxes when the config is tax-registered', async ({ seed }) => {
		const [tax] = await seed.taxes({ overrides: [{ name: 'GST' }] });
		await seed.config({ overrides: [{ taxRegistration: true }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const { id } = await createDocument(
			documentBuilder({
				clientDataId: client.versions[0].id,
				items: [{ taxes: new Set([tax.id]) }],
			}),
		);

		const record = await getDocument(id);

		expect(record.items[0].taxes).toEqual([expect.objectContaining({ id: tax.id, name: 'GST' })]);
	});

	test('Does not link taxes when the config is not tax-registered', async ({ seed }) => {
		const [tax] = await seed.taxes({ count: 1 });
		await seed.config({ overrides: [{ taxRegistration: false }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		await createDocument(
			documentBuilder({
				clientDataId: client.versions[0].id,
				items: [{ taxes: new Set([tax.id]) }],
			}),
		);

		const itemTaxes = await withRLS(db => db.select().from(tables.itemTaxes));
		expect(itemTaxes).toHaveLength(0);
	});

	test('Empty strings are recorded as null', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const { id } = await createDocument(
			documentBuilder({
				clientDataId: client.versions[0].id,
				title: '',
				description: '',
				items: [{ note: '' }],
			}),
		);

		await expect(getDocument(id)).resolves.toMatchObject({
			title: null,
			description: null,
			items: [{ note: null }],
		});
	});

	test('Trims whitespace from string values', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const { id } = await createDocument(
			documentBuilder({
				clientDataId: client.versions[0].id,
				title: '  Website work  ',
				description: '  June retainer  ',
				items: [{ label: '  Consulting services  ', note: '  Discounted  ' }],
			}),
		);

		await expect(getDocument(id)).resolves.toMatchObject({
			title: 'Website work',
			description: 'June retainer',
			items: [{ label: 'Consulting services', note: 'Discounted' }],
		});
	});

	test('Rejects when the document has no items', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const input = documentBuilder({ clientDataId: client.versions[0].id, items: [] });
		await expect(createDocument(input)).rejects.toThrow();
	});

	test('Rejects when the user has no config', async ({ seed }) => {
		// Clients need no config, so the client reference is valid and only the config is missing
		const [client] = await seed.clients({ count: 1, versions: 1 });
		expect(await withRLS(db => db.$count(tables.config))).toBe(0);

		await expect(
			createDocument(documentBuilder({ clientDataId: client.versions[0].id })),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});

	test('Rejects document referencing client owned by another user', async ({ auth, seed }) => {
		await seed.config();
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({ count: 1 });

		const otherClientData = otherClient.versions.find(version => version.validTo === null);
		assert(otherClientData, 'Seeded client should have an active version');

		// Checks that withRLS is not the only protection
		await expect(
			bypassRLS(() => createDocument(documentBuilder({ clientDataId: otherClientData.id }))),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});

	test('Rejects an item referencing tax belonging to another user', async ({ auth, seed }) => {
		await seed.config({ overrides: [{ taxRegistration: true }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const other = await createTestSession(auth);
		const [otherTax] = await seed({ userId: other.user.id }).taxes();

		// Checks that withRLS is not the only protection
		await expect(
			bypassRLS(() =>
				createDocument(
					documentBuilder({
						clientDataId: client.versions[0].id,
						items: [{ taxes: new Set([otherTax.id]) }],
					}),
				),
			),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});

	test('Rejects an item referencing a tax the config does not offer', async ({ seed }) => {
		const [offered, withheld] = await seed.taxes({ count: 2 });
		await seed.config({ overrides: [{ taxRegistration: true, taxes: [offered.id] }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		await expect(
			createDocument(
				documentBuilder({
					clientDataId: client.versions[0].id,
					items: [{ taxes: new Set([offered.id, withheld.id]) }],
				}),
			),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});
});
