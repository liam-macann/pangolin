import { describe, expect, test } from 'vitest';

import { DEFAULT_INVOICE_SORT } from '@/lib/hooks/data/invoice';

import { parseTableParams, tableParams } from './params';

describe('sort', () => {
	const schema = tableParams.shape.sort;

	test('Decodes sort format', () => {
		expect(schema.decode('-amount,name')).toEqual([
			{ id: 'amount', desc: true },
			{ id: 'name', desc: false },
		]);
	});

	test('Encodes sort format', () => {
		expect(
			schema.encode([
				{ id: 'amount', desc: true },
				{ id: 'name', desc: false },
			]),
		).toBe('-amount,name');
	});

	test.for([
		['-amont,name', [{ id: 'name', desc: false }]],
		['-amount,amount', [{ id: 'amount', desc: true }]],
		['-amont,clientId', undefined],
		['', undefined],
	] as const)('Decodes %j and drops invalid values', ([sort, sorting]) => {
		expect(schema.decode(sort)).toEqual(sorting);
	});

	test('Encodes nothing for default and empty sorts', () => {
		const defaultSort = parseTableParams({ sort: DEFAULT_INVOICE_SORT.join(',') }).sort;

		expect(schema.encode(defaultSort)).toBeUndefined();
		expect(schema.encode([])).toBeUndefined();
	});
});

describe('page', () => {
	const schema = tableParams.shape.page;

	test.for([
		['3', 2],
		['1', undefined],
		['0', undefined],
		['2.5', undefined],
		['abc', undefined],
	] as const)('Decodes %j → %j', ([page, pageIndex]) => {
		expect(schema.decode(page)).toBe(pageIndex);
	});

	test.for([
		[1, '2'],
		[0, undefined],
	] as const)('Encodes %i → %j', ([pageIndex, page]) => {
		expect(schema.encode(pageIndex)).toBe(page);
	});
});

test('Ignores a malformed param without discarding the others', () => {
	const client = crypto.randomUUID();

	const invalid = { sort: ['name', '-amount'], client: 'not-a-uuid' };

	expect(parseTableParams({ ...invalid, q: 'search' })).toEqual({ q: 'search' });
	expect(parseTableParams(new URLSearchParams({ client, page: 'text' }))).toEqual({ client });
});
