import { PGlite } from '@electric-sql/pglite';
import { type Column } from 'drizzle-orm';
import {
	PgChar,
	PgCustomColumn,
	PgDate,
	PgDateString,
	PgNumeric,
	PgText,
	PgTimestamp,
	PgTimestampString,
	PgUUID,
	PgVarchar,
} from 'drizzle-orm/pg-core';
import { afterAll, assert, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { Address } from '@/api/dto/address';
import { Client } from '@/api/dto/client';
import { Config } from '@/api/dto/config';
import { Invoice } from '@/api/dto/invoice';
import { getNumericColumnPrecision, getTextColumnBounds } from '@/lib/utils/drizzle';
import { collectNodes, getBounds } from '@/lib/zod';
import * as tables from '@/db/schema';
import { isUnicode } from '@/db/schema/types';

type FieldMapping = [column: Column, path: string];

interface DTOConfig {
	dto: z.ZodObject;
	fields: FieldMapping[];
	exempt?: string[];
}

const addressFields = (prefix?: string): FieldMapping[] => [
	[tables.address.dependentLocality, [prefix, 'dependentLocality'].filter(Boolean).join('.')],
	[tables.address.city, [prefix, 'city'].filter(Boolean).join('.')],
	[tables.address.administrativeArea, [prefix, 'administrativeArea'].filter(Boolean).join('.')],
	[tables.address.postalCode, [prefix, 'postalCode'].filter(Boolean).join('.')],
	[tables.address.sortingCode, [prefix, 'sortingCode'].filter(Boolean).join('.')],
	[tables.address.streetAddress, [prefix, 'streetAddress.items'].filter(Boolean).join('.')],
];

const DTOs: DTOConfig[] = [
	{
		dto: Address,
		fields: addressFields(),
	},
	{
		dto: Client,
		fields: [
			[tables.clients.id, 'id'],
			[tables.clientData.id, 'data.version'],
			[tables.clientData.name, 'data.name'],
			[tables.clientData.organization, 'data.organization'],
			[tables.clientData.email, 'data.email'],
			[tables.clientData.notes, 'data.notes'],
			...addressFields('data.address'),
		],
		exempt: [
			// Derived at read time, not persisted
			'data.formattedAddress',
		],
	},
	{
		dto: Config,
		fields: [
			[tables.config.id, 'id'],
			[tables.config.tradingName, 'tradingName'],
			[tables.config.language, 'language'],
			[tables.config.region, 'region'],
			[tables.config.currency, 'currency'],
			[tables.taxes.id, 'taxes.items.id'],
			[tables.taxes.name, 'taxes.items.name'],
			[tables.taxes.rate, 'taxes.items.rate'],
			...addressFields('address'),
			[tables.config.email, 'email'],
			[tables.config.phone, 'phone'],
			[tables.config.header, 'header'],
			[tables.config.paymentDetails, 'paymentDetails.items'],
			[tables.config.tradingNumber, 'tradingNumber.items'],
		],
		exempt: [
			// db.config.timezone has no char_length check
			'timezone',
			// db.config.locale is `generatedAlwaysAs` with no char_length check
			'locale',
		],
	},
	{
		dto: Invoice,
		fields: [
			[tables.invoices.id, 'id'],
			[tables.clients.id, 'client.id'],
			[tables.documents.title, 'title'],
			[tables.documents.description, 'description'],
			[tables.clientData.name, 'client.name'],
			[tables.clientData.organization, 'client.organization'],
			[tables.invoiceStatus.notes, 'notes'],
			[tables.config.currency, 'currency'],
			[tables.invoices.issuedAt, 'issuedAt'],
			[tables.invoices.dueAt, 'dueAt'],
			[tables.documents.createdAt, 'createdAt'],
		],
		exempt: [
			// Derived from partition + index, not persisted
			'reference',
			// Derived by the document_with_sum database view
			'netTotal',
			'grossTotal',
			// tables.config.timezone has no char_length check
			'timezone',
		],
	},
];

/** Predicate that returns Zod string types */
const isString = (s: z.core.$ZodType) => s instanceof z.ZodString || s instanceof z.ZodStringFormat;

describe('API contract fields are compatible with database storage constraints', () => {
	describe.for(
		DTOs.map(v => {
			const name = v.dto.meta()?.ref;
			assert(typeof name === 'string', 'DTO metadata ref missing');
			return { name, ...v };
		}),
	)('$name', ({ name, dto, fields, exempt }) => {
		test.for(fields.map(([column, path]) => ({ column, path })))(
			`${name}[$path] → $column.name`,
			({ column, path }, ctx) => {
				const field = collectNodes(
					dto,
					(_, candidatePath): _ is z.core.$ZodType => candidatePath === path,
				).at(-1)?.schema;

				assert(field, `Missing Zod field ${name}.${path}`);

				if (column instanceof PgUUID) return assert(field instanceof z.ZodUUID, 'Expected UUID');

				if (column instanceof PgTimestamp || column instanceof PgTimestampString)
					return assert(field instanceof z.ZodISODateTime, 'Expected ISO date-time');

				if (column instanceof PgDate || column instanceof PgDateString)
					return assert(field instanceof z.ZodISODate, 'Expected ISO date');

				if (column instanceof PgCustomColumn && column.getSQLType() === 'bytea')
					return ctx.skip(`${column.name} is encrypted`);

				if (column instanceof PgNumeric) {
					// We expect NUMERIC to be mapped to NumericString, not a generic z.string()
					assert(field instanceof z.ZodString, 'Expected numeric string');

					const { maximum } = getBounds(field);
					assert(Number.isFinite(maximum), 'Missing maximum length on Zod schema');

					const numeric = getNumericColumnPrecision(column);
					assert(numeric, 'Expected NUMERIC to declare a precision');

					// Scale may be negative
					const fractionDigits = Math.max(numeric.scale, 0);
					const integerDigits = Math.max(numeric.precision - numeric.scale, 1);

					const maxLength =
						integerDigits + // Precision
						fractionDigits + // Scale
						(fractionDigits > 0 ? 1 : 0) + // Decimal point
						1; // Signed bit

					return expect(maximum).toBeGreaterThanOrEqual(maxLength);
				}

				assert(
					column instanceof PgChar ||
						column instanceof PgText ||
						column instanceof PgVarchar ||
						isUnicode(column),
					'Expected a text column',
				);

				const { maximum } = getBounds(field, isString);
				const { maxLength } = getTextColumnBounds(column);

				assert(Number.isFinite(maxLength), `Length constraint missing for ${column.name}`);
				assert(Number.isFinite(maximum), `Missing maximum constraint`);

				expect(maximum).toBeGreaterThanOrEqual(maxLength);
			},
		);

		test('All string fields have a database mapping', () => {
			const mapped = new Set([...fields.map(([, path]) => path), ...(exempt ?? [])]);
			const unmapped = collectNodes(dto, isString)
				.map(({ path }) => path)
				.filter(path => !mapped.has(path));

			assert(
				unmapped.length === 0,
				[`"${name}" is missing field mappings for:`, ...unmapped.map(path => `- ${path}`)].join(
					'\n',
				),
			);
		});
	});
});

const postgres = new PGlite();

describe('Zod .length() and Postgres char_length() use identical Unicode code point evaluation', () => {
	test.for([
		['ASCII', 'abc'],
		['precomposed characters', 'éñø'],
		['combining characters', 'e\u0301n\u0303a\u030a'],
		['astral characters', '😀𝄞𐐷'],
		['regional indicator pairs', '🇦🇺🇯🇵🇺🇳'],
		['zero-width joiner sequences', '👨‍👩‍👧‍👦👩‍💻🧑‍🚀'],
	])('%s', async ([, str]) => {
		/** Destructuring a string returns an array of codepoints */
		const codepoints = [...str].length;

		const result = await postgres.query<{ length: number }>(
			'SELECT char_length($1::text) AS length',
			[str],
		);

		expect(result.rows[0]?.length).toBe(codepoints);
		expect(z.string().length(codepoints).safeParse(str).success).toBe(true);

		expect(
			z
				.string()
				.min(codepoints + 1)
				.safeParse(str).success,
		).toBe(false);

		expect(
			z
				.string()
				.max(codepoints - 1)
				.safeParse(str).success,
		).toBe(false);
	});
});

afterAll(async () => await postgres.close());
