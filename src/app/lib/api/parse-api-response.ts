import { type ClientResponse } from 'hono/client';
import { type StatusCode } from 'hono/utils/http-status';
import { ProblemDetailsError, problemDetails } from 'hono-problem-details';

import { ProblemDetails } from '@/api/errors';

/** A Hono RPC JSON response whose successful branch carries a `{ data }` envelope. */
type EnvelopeResponse<T> = ClientResponse<T, StatusCode, 'json'>;

/** Parses a successful response body, or throws a {@link ProblemDetailsError} for an RFC 9457 error response */
export async function parseAPIRes<T extends object>(
	resPromise: EnvelopeResponse<T> | Promise<EnvelopeResponse<T>>,
): Promise<T> {
	const res = await resPromise;

	if (!res.ok) {
		const body = await res.json().catch(() => null);

		const { code, ...problem } = ProblemDetails.catch({
			...problemDetails({ status: res.status }).problemDetails,
		}).parse(body);

		// Our wire format flattens extensions, so non-spec properties must be re-nested
		throw new ProblemDetailsError({ ...problem, extensions: code ? { code } : undefined });
	}

	const json = await res.json();

	// Runtime guard
	if (json === null || !('data' in json)) throw new Error('Invalid API response envelope');

	return json;
}
