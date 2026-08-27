import { type ClientResponse } from 'hono/client';
import { type StatusCode } from 'hono/utils/http-status';
import { problemDetails } from 'hono-problem-details';

import { ProblemDetails } from '@/api/errors';

/** A Hono RPC JSON response whose successful branch carries a `{ data }` envelope. */
type EnvelopeResponse<T> = ClientResponse<T, StatusCode, 'json'>;

/** Parses a successful response body, or throws a `ProblemDetails` RFC 9457 error response. */
export async function parseAPIRes<T>(
	resPromise: EnvelopeResponse<T> | Promise<EnvelopeResponse<T>>,
): Promise<T> {
	const res = await resPromise;

	if (!res.ok) {
		const body: unknown = await res.json().catch(() => null);

		throw ProblemDetails.catch({
			...problemDetails({ status: res.status }).problemDetails,
		}).parse(body);
	}

	const json = await res.json();
	if (!isEnvelope<T>(json)) throw new Error('Invalid API response envelope');
	return json;
}

const isEnvelope = <T>(body: unknown): body is T =>
	typeof body === 'object' && body !== null && 'data' in body;
