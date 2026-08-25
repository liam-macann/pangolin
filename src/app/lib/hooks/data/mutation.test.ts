import { cloneDeep } from 'es-toolkit';
import { describe, expect, test } from 'vitest';

import { isIntentSuperseded, selectOptimisticIntents } from './mutation';

const first = Symbol('first');
const second = Symbol('second');
const third = Symbol('third');
const unrelated = Symbol('unrelated');

const getIntent = (context: unknown) =>
	context === first || context === second || context === third ? context : undefined;

describe('selectOptimisticIntents()', () => {
	test('Keeps a newer successful intent while an earlier intent is pending', () => {
		const intents = selectOptimisticIntents(
			[
				{ context: first, mutationId: 2, status: 'pending' },
				{ context: second, mutationId: 3, status: 'success' },
			],
			getIntent,
		);

		expect(intents).toEqual([first, second]);
	});

	test('Uses the earliest related pending mutation as the visibility boundary', () => {
		const intents = selectOptimisticIntents(
			[
				{ context: first, mutationId: 1, status: 'success' },
				{ context: second, mutationId: 2, status: 'pending' },
				{ context: first, mutationId: 3, status: 'success' },
			],
			getIntent,
		);

		expect(intents).toEqual([second, first]);
	});

	test('Calculates the visibility boundary independently for each scope', () => {
		const otherScope = Symbol('other scope');

		const intents = selectOptimisticIntents(
			[
				{ context: first, mutationId: 1, scope: { id: 'favorite' }, status: 'pending' },
				{ context: otherScope, mutationId: 2, scope: { id: 'archive' }, status: 'success' },
			],
			getIntent,
		);

		expect(intents).toEqual([first]);
	});

	test('Returns intents in submission (mutationId) order', () => {
		const intents = selectOptimisticIntents(
			[
				{ context: second, mutationId: 2, status: 'pending' },
				{ context: first, mutationId: 1, status: 'pending' },
				{ context: third, mutationId: 3, status: 'success' },
			],
			getIntent,
		);

		expect(intents).toEqual([first, second, third]);
	});

	test('Drops settled intents when no related mutation is pending', () => {
		const intents = selectOptimisticIntents(
			[
				{ context: first, mutationId: 1, status: 'success' },
				{ context: second, mutationId: 2, status: 'error' },
			],
			getIntent,
		);

		expect(intents).toEqual([]);
	});

	test('Ignores idle, failed, and unrelated mutations', () => {
		const intents = selectOptimisticIntents(
			[
				{ context: unrelated, mutationId: 1, status: 'pending' },
				{ context: first, mutationId: 2, status: 'idle' },
				{ context: second, mutationId: 3, status: 'error' },
			],
			getIntent,
		);

		expect(intents).toEqual([]);
	});

	test.for([
		['0', 0],
		['false', false],
		['empty string', ''],
		['null', null],
	])('Treats %s as an intent', ([, value]) => {
		const intents = selectOptimisticIntents(
			[{ context: value, mutationId: 1, scope: { id: 'scope' }, status: 'pending' }],
			context => (context === value ? value : undefined),
		);

		expect(intents).toEqual([value]);
	});

	test('Does not alter the mutation-cache snapshot', () => {
		const mutations = [
			{ context: second, mutationId: 2, status: 'pending' },
			{ context: first, mutationId: 1, status: 'pending' },
		] as const;

		const clone = cloneDeep(mutations);
		selectOptimisticIntents(mutations, getIntent);
		expect(mutations).toEqual(clone);
	});
});

describe('isIntentSuperseded()', () => {
	test('Finds a newer pending intent in the same scope', () => {
		const superseded = isIntentSuperseded(
			[
				{ context: first, mutationId: 1, status: 'error' },
				{ context: second, mutationId: 2, status: 'pending' },
			],
			first,
			getIntent,
		);

		expect(superseded).toBe(true);
	});

	test('Ignores newer intents in another scope', () => {
		const superseded = isIntentSuperseded(
			[
				{ context: first, mutationId: 1, scope: { id: 'favorite' }, status: 'error' },
				{ context: second, mutationId: 2, scope: { id: 'archive' }, status: 'pending' },
			],
			first,
			getIntent,
		);

		expect(superseded).toBe(false);
	});

	test('Ignores settled and unrelated newer mutations', () => {
		const superseded = isIntentSuperseded(
			[
				{ context: first, mutationId: 1, status: 'error' },
				{ context: second, mutationId: 2, status: 'success' },
				{ context: unrelated, mutationId: 3, status: 'pending' },
			],
			first,
			getIntent,
		);

		expect(superseded).toBe(false);
	});

	test('Returns false when the current intent is absent', () => {
		const mutations = [{ context: second, mutationId: 2, status: 'pending' }] as const;

		expect(isIntentSuperseded(mutations, first, getIntent)).toBe(false);
		expect(isIntentSuperseded(mutations, undefined, getIntent)).toBe(false);
	});
});
