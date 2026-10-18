import 'server-only';

import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { decode as decodeCBOR, encode as encodeCBOR } from 'cbor-x';
import { z } from 'zod';

import { problems } from '@/api/errors';

import { auth } from '@/auth';

import { Direction, type Sort } from './sort';

/** Maximum code point length of a pagination cursor. */
const MAX_CURSOR_LENGTH = 4096;

/** Encoding of a pagination cursor. */
const encoding = z.base64url();

export type Cursor = z.infer<typeof Cursor>;
export const Cursor = z.string().meta({
	description: 'Opaque cursor identifying where to resume pagination.',
	// Encoding and length are documented here, but validated by `parse()`, which returns a domain problem.
	// Validating in this schema would return a generic validation error.
	contentEncoding: 'base64url',
	pattern: z.core.regexes.base64url.source,
	maxLength: MAX_CURSOR_LENGTH,
});

/** Sort values of a row, read as text in key order. */
export type SortValues = z.infer<typeof SortValues>;
export const SortValues = z.array(z.string().nullable());

/** Position of a cursor in the list. */
type Envelope = z.infer<typeof Envelope>;
const Envelope = z.object({
	/** Envelope version, so the format can change without misreading older cursors. */
	v: z.literal(1),
	/** Sort the cursor was minted under, most significant field first. */
	sort: z.record(z.string(), Direction.optional()),
	/** Sort values of the last row returned on the previous page, ending on its identifier. */
	values: SortValues,
});

/** Throw a problem details error from the registry. */
const invalidCursor = (detail: string): never => {
	throw problems.create('INVALID_CURSOR', { detail });
};

/** Byte length of the signature, appended to the payload. */
const SIGNATURE_LENGTH = 16;

const key = await auth.$context.then(({ secret }) =>
	// Derives a new key from the auth secret
	Buffer.from(hkdfSync('sha256', secret, '', 'pagination-cursor', 32)),
);

/** What a cursor is minted for, which is signed but not carried in the payload. */
export type Context = {
	/** Name of the table the cursor pages through.
	 * @remarks This is just a proxy for the route path, without having to add another param. */
	table: string;
};

/** Sign a payload with its context, to prevent tampering and invalid reuse across routes. */
const sign = (payload: Buffer, ctx: Context) =>
	createHmac('sha256', key)
		.update(encodeCBOR([ctx.table]))
		.update(payload)
		.digest()
		.subarray(0, SIGNATURE_LENGTH);

/** Encode the position of a cursor in its context. */
export const encode = (position: Omit<Envelope, 'v'>, ctx: Context) => {
	// Fields the sort leaves unset are dropped when it is serialized
	const sort = Object.fromEntries(
		Object.entries(position.sort).filter(([, direction]) => direction !== undefined),
	);
	const payload = encodeCBOR({ v: 1, ...position, sort });
	const value = Buffer.concat([payload, sign(payload, ctx)]).toString('base64url');
	if (value.length > MAX_CURSOR_LENGTH) throw new Error('Generated cursor exceeds maximum length');
	return value;
};

/** Decode a cursor and check it against its context, and the requested sort. */
export const parse = (cursor: Cursor | undefined, sort: Sort<string>, ctx: Context) => {
	if (!cursor) return undefined;
	if (cursor.length > MAX_CURSOR_LENGTH) return invalidCursor('Cursor exceeds the maximum length.');

	// Buffer.from decoding is lenient, and would otherwise skip over invalid characters
	if (!encoding.validate(cursor)) return invalidCursor('Cursor encoding is invalid.');

	const bytes = Buffer.from(cursor, 'base64url');
	const payload = bytes.subarray(0, -SIGNATURE_LENGTH);
	const signature = bytes.subarray(-SIGNATURE_LENGTH);
	if (signature.length !== SIGNATURE_LENGTH || !timingSafeEqual(signature, sign(payload, ctx)))
		return invalidCursor('Cursor signature is invalid.');

	let decoded: unknown;
	try {
		decoded = decodeCBOR(payload);
	} catch {
		return invalidCursor('Cursor payload is invalid.');
	}
	const parsed = Envelope.safeParse(decoded);
	if (!parsed.success) return invalidCursor('Cursor payload is invalid.');

	// Stringify drops unset fields and preserves the order of string property keys
	if (JSON.stringify(parsed.data.sort) !== JSON.stringify(sort))
		return invalidCursor('Cursor does not match the requested sort.');

	return parsed.data;
};
