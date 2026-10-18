import { encode as encodeCBOR } from 'cbor-x';
import { describe, expect, test } from 'vitest';

import { encode, parse } from './cursor';

/** Replace the payload of a signed cursor, keeping its signature. */
const forge = (cursor: string, payload: object) =>
	Buffer.concat([encodeCBOR(payload), Buffer.from(cursor, 'base64url').subarray(-16)]).toString(
		'base64url',
	);

describe('Cursor validation', () => {
	test('Round-trips text values while omitting unset sort fields', () => {
		const sort = { position: 'desc', label: undefined } as const;
		const values = ['9007199254740993', 'item-a'];

		expect(parse(encode({ sort, values }, { table: 'items' }), sort, { table: 'items' })).toEqual({
			v: 1,
			sort: { position: 'desc' },
			values,
		});
	});

	test('Rejects an oversized generated cursor as an internal error', () => {
		expect(() => encode({ sort: {}, values: ['x'.repeat(4096)] }, { table: 'items' })).toThrow(
			expect.objectContaining({
				name: 'Error',
				message: expect.stringContaining('maximum length'),
			}),
		);
	});

	test.for([
		['oversized input', 'a'.repeat(4097), 'exceeds the maximum length'],
		['invalid base64url', 'not a base64url cursor', 'encoding is invalid'],
		['an unsigned payload', Buffer.from('{}').toString('base64url'), 'signature is invalid'],
		[
			'a value replaced under the original signature',
			forge(encode({ sort: { position: 'desc' }, values: ['3', 'item-a'] }, { table: 'items' }), {
				v: 1,
				sort: { position: 'desc' },
				values: ['abc', 'item-a'],
			}),
			'signature is invalid',
		],
		[
			'a cursor minted for another table',
			encode({ sort: { position: 'desc' }, values: ['3', 'item-a'] }, { table: 'labels' }),
			'signature is invalid',
		],
		[
			'a different sort',
			encode({ sort: { position: 'asc' }, values: ['3', 'item-a'] }, { table: 'items' }),
			'does not match the requested sort',
		],
	] as const)('Rejects %s', ([_, cursor, detail]) => {
		expect(() => parse(cursor, { position: 'desc' }, { table: 'items' })).toThrow(
			expect.objectContaining({
				problemDetails: expect.objectContaining({
					status: 422,
					detail: expect.stringContaining(detail),
				}),
			}),
		);
	});
});
