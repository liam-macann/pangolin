import { eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import * as navigation from 'next/navigation';
import { describe, expect, vi } from 'vitest';

import { type Enum } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { createInvoice, setInvoiceNotes, updateInvoiceStatus, voidInvoice } from './invoice';
import {
	insertTestClient,
	insertTestInvoice,
	invoiceBuilder,
	setUpConfigAndClient,
} from './tests/helpers';

const getInvoice = (id: string) =>
	withRLS(async (db, session) =>
		db.query.invoices
			.findFirst({
				where: { id, userId: session.user.id },
				with: {
					document: { with: { items: { with: { taxes: true } } } },
					status: true,
				},
			})
			.then(res => {
				if (!res) return res;
				const { document, ...inv } = res;
				return { ...document, ...inv };
			}),
	);

describe('createInvoice', () => {
	describe('Sequencing', () => {
		test.for<[Enum<typeof tables.numberingScheme>, string | null]>([
			['sequential', null],
			['annual', '2026'],
		])('Allocates only the active %s counter', async ([scheme, partition], { session }) => {
			const seed: (typeof tables.sequencer.$inferInsert)[] = [
				{ userId: session.user.id, namespace: 'invoice', partition: null, count: 1 },
				{ userId: session.user.id, namespace: 'invoice', partition: '2025', count: 1 },
				{ userId: session.user.id, namespace: 'invoice', partition: '2026', count: 1 },
			];

			await withRLS(tx => tx.insert(tables.sequencer).values(seed));

			const { client } = await setUpConfigAndClient({ numberingScheme: scheme });
			await createInvoice(
				invoiceBuilder({
					clientDataId: client.data.scdId,
					issuedAt: new Date(`${'2026-03-01'}T00:00:00Z`),
				}),
			);

			const sequencer = await withRLS(db =>
				db
					.select({ partition: tables.sequencer.partition, count: tables.sequencer.count })
					.from(tables.sequencer)
					.orderBy(sql`${tables.sequencer.partition} nulls first`),
			);

			expect(sequencer).toEqual(
				seed.map(v => ({
					partition: v.partition,
					count: v.partition === partition ? 2 : v.count,
				})),
			);

			expect(sequencer.length).toBe(3);
		});

		test('Resets the yearly index per issue year', async () => {
			const { client } = await setUpConfigAndClient({ numberingScheme: 'annual' });

			await createInvoice(
				invoiceBuilder({
					clientDataId: client.data.scdId,
					issuedAt: new Date('2024-12-31T00:00:00Z'),
					dueAt: new Date('2024-12-31T00:00:00Z'),
				}),
			);
			await createInvoice(
				invoiceBuilder({
					clientDataId: client.data.scdId,
					issuedAt: new Date('2025-01-01T00:00:00Z'),
					dueAt: new Date('2025-01-01T00:00:00Z'),
				}),
			);

			const invoices = await withRLS(db =>
				db
					.select({ partition: tables.invoices.partition, index: tables.invoices.index })
					.from(tables.invoices),
			);

			expect(invoices).toEqual([
				{ partition: '2024', index: 1 },
				{ partition: '2025', index: 1 },
			]);
		});
	});

	test('Inserts an invoice with its items and status', async ({ session }) => {
		const { client } = await setUpConfigAndClient();

		await createInvoice(
			invoiceBuilder({
				clientDataId: client.data.scdId,
				items: [{ label: 'Consulting services', quantity: 2 }],
			}),
		);

		const [invoice] = await withRLS(db => db.select().from(tables.invoices));
		const record = await getInvoice(invoice.id);

		expect(record).toMatchObject({
			userId: session.user.id,
			index: 1,
			status: { status: 'unpaid', isVoid: false },
		});
		expect(record?.items).toHaveLength(1);
		expect(record?.items[0]).toMatchObject({ label: 'Consulting services', quantity: 2 });
	});

	test('Links items to taxes when the config is tax-registered', async ({ session }) => {
		const { configId, client } = await setUpConfigAndClient({
			taxRegistration: true,
			taxes: [{ name: 'GST', rate: 10 }],
		});

		const [tax] = await withRLS(db =>
			db
				.select({ id: tables.taxes.id })
				.from(tables.configTaxes)
				.innerJoin(tables.taxes, eq(tables.taxes.id, tables.configTaxes.taxId))
				.where(eq(tables.configTaxes.configId, configId)),
		);

		await createInvoice(
			invoiceBuilder({ clientDataId: client.data.scdId, items: [{ taxes: new Set([tax.id]) }] }),
		);

		const [invoice] = await withRLS(db =>
			db.select().from(tables.invoices).where(eq(tables.invoices.userId, session.user.id)),
		);
		const record = await getInvoice(invoice.id);

		expect(record?.items[0].taxes).toEqual([expect.objectContaining({ id: tax.id, name: 'GST' })]);
	});

	test('Does not link taxes when the config is not tax-registered', async () => {
		const { client } = await setUpConfigAndClient();
		await createInvoice(invoiceBuilder({ clientDataId: client.data.scdId }));

		const itemTaxes = await withRLS(db => db.select().from(tables.itemTaxes));
		expect(itemTaxes).toHaveLength(0);
	});

	test('Empty string title, description, notes and item note are recorded as null', async () => {
		const { client } = await setUpConfigAndClient();

		await createInvoice(
			invoiceBuilder({
				clientDataId: client.data.scdId,
				title: '',
				description: '',
				notes: '',
				items: [{ note: '' }],
			}),
		);

		const [invoice] = await withRLS(db => db.select().from(tables.invoices));
		const record = await getInvoice(invoice.id);

		expect(record).toMatchObject({ title: null, description: null, status: { notes: null } });
		expect(record?.items[0].note).toBeNull();
	});

	test('Trims whitespace from string values', async () => {
		const { client } = await setUpConfigAndClient();

		await createInvoice(
			invoiceBuilder({
				clientDataId: client.data.scdId,
				title: '  Website work  ',
				description: '  June retainer  ',
				notes: '  Check hours  ',
				items: [{ label: '  Consulting services  ', note: '  Discounted  ' }],
			}),
		);

		const [invoice] = await withRLS(db => db.select().from(tables.invoices));
		const record = await getInvoice(invoice.id);

		expect(record).toMatchObject({
			title: 'Website work',
			description: 'June retainer',
			status: { notes: 'Check hours' },
		});
		expect(record?.items[0]).toMatchObject({ label: 'Consulting services', note: 'Discounted' });
	});

	test('Rejects when the invoice has no items', async () => {
		const { client } = await setUpConfigAndClient();
		await expect(
			createInvoice(invoiceBuilder({ clientDataId: client.data.scdId, items: [] })),
		).rejects.toThrow();
	});

	test('Rejects when the due date is before the issue date', async () => {
		const { client } = await setUpConfigAndClient();
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			createInvoice(
				invoiceBuilder({
					clientDataId: client.data.scdId,
					issuedAt: new Date('2026-06-15T00:00:00Z'),
					dueAt: new Date('2026-06-01T00:00:00Z'),
				}),
			),
		).rejects.toThrow('Database Error: failed to create invoice');

		consoleError.mockRestore();
	});

	test('Invalidates the invoices cache tag', async ({ session }) => {
		const { client } = await setUpConfigAndClient();

		await createInvoice(invoiceBuilder({ clientDataId: client.data.scdId }));
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Rejects invoice referencing a client belonging to another user', async ({ db, auth }) => {
		await setUpConfigAndClient();
		const other = await createTestSession(db, auth);
		const otherClient = await sessionStorage.run(other, () => insertTestClient());

		await expect(
			createInvoice(invoiceBuilder({ clientDataId: otherClient.data.scdId })),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});

	test('Rejects an item tax referencing tax belonging to another user', async ({ db, auth }) => {
		const { client } = await setUpConfigAndClient({
			taxRegistration: true,
			taxes: [{ name: 'GST', rate: 10 }],
		});

		const other = await createTestSession(db, auth);
		const otherTax = await sessionStorage.run(other, async () => {
			await setUpConfigAndClient({ taxRegistration: true, taxes: [{ name: 'VAT', rate: 20 }] });
			const [tax] = await withRLS(db => db.select({ id: tables.taxes.id }).from(tables.taxes));
			return tax;
		});

		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			createInvoice(
				invoiceBuilder({
					clientDataId: client.data.scdId,
					items: [{ taxes: new Set([otherTax.id]) }],
				}),
			),
		).rejects.toThrow();

		consoleError.mockRestore();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});
});

/** Creates a config, client and invoice, returning the invoice id */
const setUpInvoice = async () => {
	const { client } = await setUpConfigAndClient();
	return insertTestInvoice({ clientDataId: client.data.scdId });
};

describe('updateInvoiceStatus', () => {
	test('Updates the payment status, scoped to the owning user', async ({ db, session }) => {
		const invoiceId = await setUpInvoice();

		await updateInvoiceStatus(invoiceId, 'paid');

		const [status] = await db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, invoiceId));
		expect(status.status).toBe('paid');
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Does not mutate an invoice owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const invoiceId = await sessionStorage.run(other, () => setUpInvoice());

		await updateInvoiceStatus(invoiceId, 'paid');

		const getStatus = () =>
			sessionStorage.run(other, () =>
				withRLS(db =>
					db.select().from(tables.invoiceStatus).where(eq(tables.invoiceStatus.id, invoiceId)),
				),
			);

		expect((await getStatus())[0].status).toBe('unpaid');

		// Positive control: the same call succeeds for the owning user
		await sessionStorage.run(other, () => updateInvoiceStatus(invoiceId, 'paid'));
		expect((await getStatus())[0].status).toBe('paid');
	});
});

describe('voidInvoice', () => {
	test('Marks an invoice as void without deleting it', async ({ db, session }) => {
		const invoiceId = await setUpInvoice();

		await voidInvoice(invoiceId);

		const [status] = await db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, invoiceId));

		expect(status.isVoid).toBe(true);
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Does not mutate an invoice owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const invoiceId = await sessionStorage.run(other, () => setUpInvoice());

		await voidInvoice(invoiceId);

		const getStatus = () =>
			sessionStorage.run(other, () =>
				withRLS(db =>
					db.select().from(tables.invoiceStatus).where(eq(tables.invoiceStatus.id, invoiceId)),
				),
			);

		expect((await getStatus())[0].isVoid).toBe(false);

		// Positive control: the same call succeeds for the owning user
		await sessionStorage.run(other, () => voidInvoice(invoiceId));
		expect((await getStatus())[0].isVoid).toBe(true);
	});
});

describe('setInvoiceNotes', () => {
	test('Updates private notes on the invoice status row', async ({ db, session }) => {
		const invoiceId = await setUpInvoice();

		await setInvoiceNotes(invoiceId, 'Follow up next month');

		const [status] = await db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, invoiceId));

		expect(status.notes).toBe('Follow up next month');
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Trims whitespace from notes', async ({ db }) => {
		const invoiceId = await setUpInvoice();

		await setInvoiceNotes(invoiceId, '  Follow up next month  ');

		const [status] = await db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, invoiceId));

		expect(status.notes).toBe('Follow up next month');
	});

	test('Empty string notes are recorded as null', async ({ db }) => {
		const invoiceId = await setUpInvoice();

		await setInvoiceNotes(invoiceId, '');

		const [status] = await db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, invoiceId));

		expect(status.notes).toBeNull();
	});

	test('Does not mutate an invoice owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const invoiceId = await sessionStorage.run(other, () => setUpInvoice());

		await setInvoiceNotes(invoiceId, 'Hijacked note');

		const getStatus = () =>
			sessionStorage.run(other, () =>
				withRLS(db =>
					db.select().from(tables.invoiceStatus).where(eq(tables.invoiceStatus.id, invoiceId)),
				),
			);

		expect((await getStatus())[0].notes).toBeNull();

		// Positive control: the same call succeeds for the owning user
		await sessionStorage.run(other, () => setInvoiceNotes(invoiceId, 'Follow up next month'));
		expect((await getStatus())[0].notes).toBe('Follow up next month');
	});
});
