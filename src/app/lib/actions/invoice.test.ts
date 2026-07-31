import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { beforeEach, describe, expect, vi } from 'vitest';

import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

import { createInvoice, setInvoiceNotes, updateInvoiceStatus, voidInvoice } from './invoice';
import { insertTestInvoice, invoiceBuilder, setUpConfigAndClient } from './tests/helpers';

const getInvoice = (id: string) =>
	withRLS(async (db, session) =>
		db.query.invoices.findFirst({
			where: { id, userId: session.user.id },
			with: { items: { with: { taxes: true } }, status: true },
		}),
	);

describe('createInvoice', () => {
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
			yearIndex: 1,
			status: { status: 'unpaid', isVoid: false },
		});
		expect(record?.items).toHaveLength(1);
		expect(record?.items[0]).toMatchObject({ label: 'Consulting services', quantity: 2 });
	});

	test('Increments the sequential index across invoices in the same year', async () => {
		const { client } = await setUpConfigAndClient();

		await createInvoice(invoiceBuilder({ clientDataId: client.data.scdId }));
		await createInvoice(invoiceBuilder({ clientDataId: client.data.scdId }));

		const invoices = await withRLS(db =>
			db
				.select({ index: tables.invoices.index, yearIndex: tables.invoices.yearIndex })
				.from(tables.invoices)
				.orderBy(tables.invoices.index),
		);

		expect(invoices).toEqual([
			{ index: 1, yearIndex: 1 },
			{ index: 2, yearIndex: 2 },
		]);
	});

	test('Resets the yearly index per issue year while the global index keeps incrementing', async () => {
		const { client } = await setUpConfigAndClient();

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
				.select({ index: tables.invoices.index, yearIndex: tables.invoices.yearIndex })
				.from(tables.invoices)
				.orderBy(tables.invoices.index),
		);

		expect(invoices).toEqual([
			{ index: 1, yearIndex: 1 },
			{ index: 2, yearIndex: 1 },
		]);
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
});
