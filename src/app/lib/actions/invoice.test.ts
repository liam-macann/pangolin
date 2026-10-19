import { eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import * as navigation from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { assert, describe, expect, onTestFinished, vi } from 'vitest';
import { z } from 'zod';

import { type Enum } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { createInvoice, setInvoiceNotes, updatePaymentStatus, voidInvoice } from './invoice';
import { invoiceBuilder } from './tests/builders';

const getInvoice = async (id: string) => {
	const res = await withRLS(async (db, session) =>
		db.query.invoices
			.findFirst({
				where: { id, userId: session.user.id },
				with: { document: true, status: true },
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
			async ([scheme, expectedPartition], { auth, session, seed }) => {
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

				// Another user counts every same partition, further along, and must be left alone
				const other = await createTestSession(auth);
				const otherWatermarks = watermarks.map(v => ({ ...v, userId: other.user.id, count: 17 }));
				await bypassRLS(tx => tx.insert(tables.sequencer).values(otherWatermarks));

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

				const otherSequencer = await bypassRLS(tx =>
					tx
						.select({ count: tables.sequencer.count })
						.from(tables.sequencer)
						.where(eq(tables.sequencer.userId, other.user.id)),
				);
				expect(otherSequencer).toEqual(otherWatermarks.map(v => ({ count: v.count })));
			},
		);
	});

	test('Inserts an invoice with its status row', async ({ session, seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(invoiceBuilder({ clientDataId: client.versions[0].id }));

		await expect(getInvoice(id)).resolves.toMatchObject({
			userId: session.user.id,
			index: 1,
			status: { status: 'unpaid', isVoid: false }, // `invoice_status` table
		});

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

	test.for([
		['Pacific/Kiritimati', '2023-06-16'],
		['Pacific/Pago_Pago', '2023-06-14'],
	])('Stores the issue date in timezone %s', async ([timezone, expected], { seed }) => {
		// UTC → 15 June;
		// already the 16th in Kiritimati;
		// still the 14th in Pago Pago
		await setTransactionTimestamp('2023-06-15T10:30:00Z');
		await seed.config({ overrides: [{ timezone }] });
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(invoiceBuilder({ clientDataId: client.versions[0].id }));

		await expect(getInvoice(id)).resolves.toMatchObject({ issuedAt: expected });
	});

	test('Empty string notes are recorded as null', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(
			invoiceBuilder({ clientDataId: client.versions[0].id, notes: '' }),
		);

		await expect(getInvoice(id)).resolves.toMatchObject({ status: { notes: null } });
	});

	test('Trims whitespace from notes', async ({ seed }) => {
		await seed.config();
		const [client] = await seed.clients({ count: 1, versions: 1 });

		const id = await createInvoice(
			invoiceBuilder({ clientDataId: client.versions[0].id, notes: '  Check hours  ' }),
		);

		await expect(getInvoice(id)).resolves.toMatchObject({ status: { notes: 'Check hours' } });
	});

	test('Rejects when the due date is before the issue date', async ({ seed }) => {
		await setTransactionTimestamp('2023-06-15T10:30:00Z');
		await seed.config({ overrides: { timezone: 'Africa/Abidjan' } });
		const [client] = await seed.clients({ count: 1, versions: 1 });
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		onTestFinished(() => consoleError.mockRestore());

		// Due date is allowed to be set to the issue date (in the database)
		const clientDataId = client.versions[0].id;
		await createInvoice(invoiceBuilder({ clientDataId, dueAt: '2023-06-15' }));

		const input = invoiceBuilder({ clientDataId, dueAt: '2023-06-14' });
		await expect(createInvoice(input)).rejects.toThrow('Database Error: failed to create invoice');

		// The wrapper message is generic, so the logged cause identifies the constraint
		expect(consoleError).toHaveBeenCalledWith(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'chk_due_after_issued' }),
			}),
		);
	});

	test('Rejects invoice referencing client owned by another user', async ({ auth, seed }) => {
		await seed.config();
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({ count: 1, versions: 1 });

		const input = invoiceBuilder({ clientDataId: otherClient.versions[0].id });

		// notFound() must pass through the error wrapper, rather than becoming a database error
		await expect(bypassRLS(() => createInvoice(input))).rejects.not.toThrow('Database Error');
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await bypassRLS(db => db.$count(tables.documents))).toBe(0);
		expect(await bypassRLS(db => db.$count(tables.invoices))).toBe(0);
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

describe('updatePaymentStatus', () => {
	const getPaymentStatus = (id: string) => getInvoiceStatus(id).then(res => res.status);

	test('Updates the payment status', async ({ session, seed }) => {
		const [seeded] = await seed.invoices({ overrides: [{ status: { status: 'unpaid' } }] });

		await updatePaymentStatus(seeded.id, 'paid');

		await expect(getPaymentStatus(seeded.id)).resolves.toBe('paid');
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});

	test('Does not mutate an invoice owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [seeded] = await seed({ userId: other.user.id }).invoices({
			overrides: [{ status: { status: 'unpaid' } }],
		});

		// Checks that withRLS is not the only protection
		await expect(bypassRLS(() => updatePaymentStatus(seeded.id, 'paid'))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(getPaymentStatus(seeded.id), 'Expected no change').resolves.toBe('unpaid');
	});

	test('Rejects an unknown payment status', async ({ seed }) => {
		const [seeded] = await seed.invoices({ overrides: [{ status: { status: 'unpaid' } }] });

		// @ts-expect-error: Server action arguments are untrusted at runtime
		await expect(updatePaymentStatus(seeded.id, 'overdue')).rejects.toThrow(z.ZodError);

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

		// Checks that withRLS is not the only protection
		await expect(bypassRLS(() => voidInvoice(seeded.id))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await getVoidStatus(seeded.id), 'Expected no change').toBe(false);
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

		// Checks that withRLS is not the only protection
		await expect(bypassRLS(() => setInvoiceNotes(invoiceId, 'Hijacked note'))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await getInvoiceNotes(invoiceId), 'Expected no change').toBe(seeded);
	});
});

test.for([
	['updatePaymentStatus', (id: string) => updatePaymentStatus(id, 'paid')],
	['voidInvoice', (id: string) => voidInvoice(id)],
	['setInvoiceNotes', (id: string) => setInvoiceNotes(id, 'Follow up next month')],
] as const)('%s rejects a malformed invoice ID before querying', async ([, action]) => {
	await expect(action('not-a-uuid')).rejects.toThrow(z.ZodError); // The ID should not reach Postgres
});
