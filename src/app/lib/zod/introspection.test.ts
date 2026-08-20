import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { collectNodes } from '@/lib/zod/introspection';

const isString = (schema: z.core.$ZodType) =>
	schema instanceof z.ZodString || schema instanceof z.ZodStringFormat;

const isNumber = (schema: z.core.$ZodType) =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;

const isObject = (schema: z.core.$ZodType) => schema instanceof z.ZodObject;

const isOptional = (schema: z.core.$ZodType) => schema instanceof z.ZodOptional;

describe('collectNodes()', () => {
	test('Matches root nodes', () => {
		const name = z.string();
		expect(collectNodes(name, isString)).toEqual([{ path: '', schema: name }]);

		const object = z.object({ name });
		expect(collectNodes(object, isObject)).toEqual([{ path: '', schema: object }]);
	});

	test('Finds nested fields through transparent wrappers', () => {
		const name = z.string().nullable();
		const email = z.email();
		const schema = z.object({ name, contacts: z.array(z.object({ email })), count: z.number() });

		expect(collectNodes(schema, isString)).toEqual([
			{ path: 'name', schema: name.unwrap() },
			{ path: 'contacts.items.email', schema: email },
		]);
	});

	test('Matches for predicate targeting transparent wrappers', () => {
		const name = z.string().optional();
		const email = z.email().optional();
		const schema = z.object({ name, contacts: z.object({ email }), count: z.number() });

		expect(collectNodes(schema, isOptional)).toEqual([
			{ path: 'name', schema: name },
			{ path: 'contacts.email', schema: email },
		]);
	});

	test('Finds tuple items and a variadic rest element', () => {
		const first = z.string();
		const second = z.number();
		const rest = z.string();
		const schema = z.object({ values: z.tuple([first, second], rest) });

		expect(collectNodes(schema, isString)).toEqual([
			{ path: 'values.[0]', schema: first },
			{ path: 'values.items', schema: rest },
		]);

		expect(collectNodes(schema, isNumber)).toEqual([{ path: 'values.[1]', schema: second }]);
	});

	test('Terminates recursive lazy schemas', () => {
		const recursive: z.ZodType<unknown> = z.lazy(() =>
			z.object({ name: z.string(), children: z.array(recursive) }),
		);

		expect(collectNodes(recursive, isString).map(({ path }) => path)).toEqual(['name']);
	});

	test('Terminates recursive lazy schemas, even when the getter rebuilds a fresh schema graph', () => {
		const node = (): z.core.$ZodType =>
			z.object({ name: z.string(), children: z.array(z.lazy(node)) });

		expect(collectNodes(z.lazy(node), isString).map(({ path }) => path)).toEqual(['name']);
	});

	test('Visits a shared schema at every field path', () => {
		const name = z.string();
		const schema = z.object({ legalName: name, tradingName: name });

		expect(collectNodes(schema, isString).map(({ path }) => path)).toEqual([
			'legalName',
			'tradingName',
		]);
	});

	test('Finds fields nested inside container types', () => {
		const value = z.string();
		const schema = z.object({
			union: z.union([value, z.number()]),
			intersection: z.intersection(value, z.number()),
			record: z.record(z.number(), value),
			map: z.map(z.number(), value),
			nested: z.map(z.number(), z.object({ set: z.set(value) })),
			set: z.set(value),
		});

		expect(collectNodes(schema, isString).map(({ path }) => path)).toEqual([
			'union.[0]',
			'intersection.left',
			'record.value',
			'map.value',
			'nested.value.set.items',
			'set.items',
		]);
	});

	describe('Asymmetric i/o schemas', () => {
		test("Respects { pipe: 'both' } configuration", () => {
			const input = z.string().min(2);
			const output = z.string().max(5);
			const schema = z.object({ name: input.pipe(output) });

			expect(collectNodes(schema, isString, { pipe: 'both' })).toEqual([
				{ path: 'name', schema: input },
				{ path: 'name', schema: output },
			]);
		});

		test("Respects { pipe: 'input' } configuration", () => {
			const input = z.string();
			const schema = input.transform(value => value.length);
			expect(collectNodes(schema, isString, { pipe: 'input' })).toEqual([
				{ path: '', schema: input },
			]);
		});

		test("Respects { pipe: 'output' } configuration", () => {
			const schema = z.string().pipe(z.string().max(4));

			const object = z.object({
				string: schema,
				number: z.string().transform(v => v.length),
			});

			expect(collectNodes(object, isString, { pipe: 'output' })).toEqual([
				{ path: 'string', schema: schema.out },
			]);
		});

		test('Uses a pipe output as collection shape by default', () => {
			const schema = z.object({ length: z.string().transform(value => value.length) });
			expect(collectNodes(schema, isString)).toEqual([]);
		});
	});
});
