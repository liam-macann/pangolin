import { describe, expect, test } from 'vitest';

import { createBuilder } from './builders';

describe('createBuilder', () => {
	const itemBuilder = createBuilder(() => ({
		label: 'Consulting services',
		details: [{ quantity: 1, unitCost: 150 }],
		taxes: new Set<string>(),
	}));

	test('Deep merges overrides onto the base value', () => {
		expect(itemBuilder({ details: [{ quantity: 2 }] })).toEqual({
			label: 'Consulting services',
			details: [{ quantity: 2, unitCost: 150 }],
			taxes: new Set(),
		});
	});

	test('Creates fresh mutable values for each build', () => {
		const first = itemBuilder();
		const second = itemBuilder();

		first.taxes.add('gst');

		expect(second.taxes).toEqual(new Set());
	});
});
