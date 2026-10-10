import { describe, expect, test } from 'vitest';

import { inBuiltOrder } from './utils';

describe('inBuiltOrder', () => {
	test('Restores the order rows were built in', () => {
		const built = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		const returned = [
			{ id: 'c', name: 'Third' },
			{ id: 'a', name: 'First' },
			{ id: 'b', name: 'Second' },
		];

		expect(inBuiltOrder(returned, built).map(row => row.name)).toEqual([
			'First',
			'Second',
			'Third',
		]);
		expect(returned[0].id, 'Returned rows should not be reordered in place').toBe('c');
	});
});
