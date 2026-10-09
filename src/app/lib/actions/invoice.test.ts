import { eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import * as navigation from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { assert, describe, expect, vi } from 'vitest';

import { type Enum } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { createInvoice, setInvoiceNotes, updateInvoiceStatus, voidInvoice } from './invoice';
import { invoiceBuilder } from './tests/builders';

const getInvoice = async (id: string) => {
	const res = await withRLS(async (db, session) =>
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

	assert(res, 'Expected an invoice at the supplied ID');
	return res;
};

/** Updates `transaction_timestamp()` for the rest of the test transaction, by shadowing the built-in.
 *  @remarks Column defaults and constraints were bound at migration time, and keep the real clock. */
const setTransactionTimestamp = async (instant: Temporal.InstantLike) => {
	await bypassRLS(async tx => {
		await tx.execute(sql`SET LOCAL search_path = public, pg_catalog`);
		await tx.execute(
			sql`CREATE FUNCTION public.transaction_timestamp() RETURNS timestamptz LANGUAGE sql STABLE
			AS ${sql.raw(`$$ SELECT '${Temporal.Instant.from(instant)}'::timestamptz $$`)}`,
		);
	});
};

describe('createInvoice', () => {
	describe('Sequencing', () => {
		test.for<[Enum<typeof tables.numberingScheme>, string | null]>([
			['sequential', null],
			['annual', '2023'],
		])(
			'Allocates only the active %s counter',
			async ([scheme, expectedPartition], { session, seed }) => {
				await setTransactionTimestamp('2023-06-15T00:00:00Z');
				const timezone = 'Asia/Seoul';
				const thisYear = '2023';
				const lastYear = '2022';

				await seed.config({ overrides: [{ numberingScheme: scheme, timezone }] });
				const [client] = await seed.clients({ count: 1, versions: 1 });

				const watermarks: (typeof tables.sequencer.$inferInsert)[] = [
					{ userId: session.user.id, namespace: 'invoice', partition: null, count: 1 },
					{ userId: session.user.id, namespace: 'invoice', partition: lastYear, count: 1 },
					{ userId: session.user.id, namespace: 'invoice', partition: thisYear, count: 1 },
				];

				await withRLS(tx => tx.insert(tables.sequencer).values(watermarks));

				await createInvoice(invoiceBuilder({ clientDataId: client.versions[0].id }));

				const sequencer = await withRLS(db =>
					db
						.select({ partition: tables.sequencer.partition, count: tables.sequencer.count })
						.from(tables.sequencer)
						.orderBy(sql`${tables.sequencer.partition} nulls first`),
				);

				expect(sequencer).toEqual(
					watermarks.map(v => ({
						partition: v.partition,
						count: v.partition === expectedPartition ? 2 : v.count,
					})),
				);

				const invoice = await withRLS(db =>
					db.query.invoices.findFirst({ columns: { index: true, partition: true } }),
				);
				expect(invoice).toEqual({ partition: expectedPartition, index: 2 });
			},
		);
	});

	test('Inserts an invoice with relational dependencies', async ({ session, seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(
			invoiceBuilder({
				clientDataId: client.versions[0].id,
				items: [{ label: 'Consulting services', quantity: 2 }],
			}),
		);

		const record = await getInvoice(id);

		expect(record).toMatchObject({
			userId: session.user.id,
			index: 1,
			status: { status: 'unpaid', isVoid: false }, // `invoice_status` table
		});
		expect(record?.items).toHaveLength(1); // `document` and `line_item` table
		expect(record?.items[0]).toMatchObject({ label: 'Consulting services', quantity: '2.00' });

		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test.for(['America/Phoenix', 'Australia/Perth'])(
		'Preserves calendar due date value for %s',
		async (timezone, { seed }) => {
			await seed.config({ overrides: [{ timezone }] });
			const [client] = await seed.clients({ count: 1, versions: 1 });
			const dueAt = Temporal.Now.plainDateISO().add({ days: 14 }).toString();

			const id = await createInvoice(
				invoiceBuilder({ clientDataId: client.versions[0].id, dueAt }),
			);

			await expect(getInvoice(id)).resolves.toMatchObject({ dueAt });
		},
	);

	test.for(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
		'Stores the issue date in timezone %s',
		async (timezone, { seed }) => {
			await seed.config({ overrides: [{ timezone }] });
			const [client] = await seed.clients({ count: 1, versions: 1 });

			const id = await createInvoice(invoiceBuilder({ clientDataId: client.versions[0].id }));

			const record = await getInvoice(id);

			const expected = Temporal.Instant.from(record.createdAt)
				.toZonedDateTimeISO(timezone)
				.toPlainDate()
				.toString();

			expect(record.issuedAt).toBe(expected);
		},
	);

	test('Links items to taxes when the config is tax-registered', async ({ seed }) => {
		const [tax] = await seed.taxes({ overrides: [{ name: 'GST' }] });
		await seed.config({ overrides: [{ taxRegistration: true }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(
			invoiceBuilder({
				clientDataId: client.versions[0].id,
				items: [{ taxes: new Set([tax.id]) }],
			}),
		);

		const record = await getInvoice(id);

		expect(record?.items[0].taxes).toEqual([expect.objectContaining({ id: tax.id, name: 'GST' })]);
	});

	test('Does not link taxes when the config is not tax-registered', async ({ seed }) => {
		const [tax] = await seed.taxes({ count: 1 });
		await seed.config({ overrides: [{ taxRegistration: false }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		await createInvoice(
			invoiceBuilder({
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

		const id = await createInvoice(
			invoiceBuilder({
				clientDataId: client.versions[0].id,
				title: '',
				description: '',
				notes: '',
				items: [{ note: '' }],
			}),
		);

		const record = await getInvoice(id);

		expect(record).toMatchObject({ title: null, description: null, status: { notes: null } });
		expect(record?.items[0].note).toBeNull();
	});

	test('Trims whitespace from string values', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(
			invoiceBuilder({
				clientDataId: client.versions[0].id,
				title: '  Website work  ',
				description: '  June retainer  ',
				notes: '  Check hours  ',
				items: [{ label: '  Consulting services  ', note: '  Discounted  ' }],
			}),
		);

		await expect(getInvoice(id)).resolves.toMatchObject({
			title: 'Website work',
			description: 'June retainer',
			status: { notes: 'Check hours' },
			items: [{ label: 'Consulting services', note: 'Discounted' }],
		});
	});

	test('Rejects when the invoice has no items', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const input = invoiceBuilder({ clientDataId: client.versions[0].id, items: [] });
		await expect(createInvoice(input)).rejects.toThrow();
	});

	test('Rejects when the due date is before the issue date', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const input = invoiceBuilder({ clientDataId: client.versions[0].id, dueAt: '2026-06-01' });
		await expect(createInvoice(input)).rejects.toThrow('Database Error: failed to create invoice');

		consoleError.mockRestore();
	});

	test('Rejects invoice referencing client owned by another user', async ({ auth, seed }) => {
		await seed.config();
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({ count: 1 });

		const otherClientData = otherClient.versions.find(version => version.validTo === null);
		assert(otherClientData, 'Seeded client should have an active version');

		await expect(
			createInvoice(invoiceBuilder({ clientDataId: otherClientData.id })),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});

	test('Rejects an item referencing tax belonging to another user', async ({ auth, seed }) => {
		await seed.config({ overrides: [{ taxRegistration: true }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const other = await createTestSession(auth);
		const [otherTax] = await seed({ userId: other.user.id }).taxes();

		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			createInvoice(
				invoiceBuilder({
					clientDataId: client.versions[0].id,
					items: [{ taxes: new Set([otherTax.id]) }],
				}),
			),
		).rejects.toThrow();

		consoleError.mockRestore();

		expect(await withRLS(db => db.select().from(tables.documents))).toHaveLength(0);
	});
});

const getInvoiceStatus = (id: string) =>
	bypassRLS(db =>
		db
			.select()
			.from(tables.invoiceStatus)
			.where(eq(tables.invoiceStatus.id, id))
			.then(res => res[0]),
	);

describe('updateInvoiceStatus', () => {
	const getPaymentStatus = (id: string) => getInvoiceStatus(id).then(res => res.status);

	test('Updates the payment status', async ({ session, seed }) => {
		const [seeded] = await seed.invoices({ overrides: [{ status: { status: 'unpaid' } }] });

		await updateInvoiceStatus(seeded.id, 'paid');

		await expect(getPaymentStatus(seeded.id)).resolves.toBe('paid');
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Does not mutate an invoice owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [seeded] = await seed({ userId: other.user.id }).invoices({
			overrides: [{ status: { status: 'unpaid' } }],
		});

		await bypassRLS(() => updateInvoiceStatus(seeded.id, 'paid')); // Checks that withRLS is not the only protection

		await expect(getPaymentStatus(seeded.id)).resolves.toBe('unpaid');
	});
});

describe('voidInvoice', () => {
	const getVoidStatus = (id: string) => getInvoiceStatus(id).then(res => res.isVoid);

	test('Marks an invoice as void', async ({ session, seed }) => {
		const [seeded] = await seed.invoices({ overrides: [{ status: { isVoid: false } }] });

		await voidInvoice(seeded.id);

		expect(await getVoidStatus(seeded.id)).toBe(true);
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Does not mutate an invoice owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [seeded] = await seed({ userId: other.user.id }).invoices({
			overrides: [{ status: { isVoid: false } }],
		});

		await bypassRLS(() => voidInvoice(seeded.id)); // Checks that withRLS is not the only protection

		expect(await getVoidStatus(seeded.id)).toBe(false);
	});
});

describe('setInvoiceNotes', () => {
	const getInvoiceNotes = (id: string) => getInvoiceStatus(id).then(res => res.notes);

	test('Updates private notes on the invoice status row', async ({ session, seed }) => {
		const [{ id: invoiceId }] = await seed.invoices({ count: 1 });

		await setInvoiceNotes(invoiceId, 'Follow up next month');

		await expect(getInvoiceNotes(invoiceId)).resolves.toBe('Follow up next month');
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Trims whitespace from notes', async ({ seed }) => {
		const [{ id: invoiceId }] = await seed.invoices({ count: 1 });

		await setInvoiceNotes(invoiceId, '  Follow up next month  ');

		await expect(getInvoiceNotes(invoiceId)).resolves.toBe('Follow up next month');
	});

	test('Empty string notes are recorded as null', async ({ seed }) => {
		const [{ id: invoiceId }] = await seed.invoices({ count: 1 });

		await setInvoiceNotes(invoiceId, '');

		await expect(getInvoiceNotes(invoiceId)).resolves.toBeNull();
	});

	test('Does not mutate an invoice owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [{ id: invoiceId }] = await seed({ userId: other.user.id }).invoices({ count: 1 });

		const seeded = await getInvoiceNotes(invoiceId); // Capture what was seeded

		await bypassRLS(() => setInvoiceNotes(invoiceId, 'Hijacked note')); // Checks that withRLS is not the only protection

		expect(await getInvoiceNotes(invoiceId)).toBe(seeded);
	});
});
