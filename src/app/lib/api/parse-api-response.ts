import { type StatusCode, type SuccessStatusCode } from 'hono/utils/http-status';
import { problemDetails } from 'hono-problem-details';

import { ProblemDetails } from '@/api/errors';

/** The JSON body of a response's successful (2xx) branch */
type SuccessBody<R> = R extends { json: () => Promise<infer Body>; status: infer Status }
	? Status extends SuccessStatusCode
		? Body
		: never
	: never;

type ResponseLike = {
	readonly ok: boolean;
	readonly status: StatusCode;
	json: () => Promise<unknown>;
};

/** The successful response body, including its `{ data, meta }` envelope */
export type APIResponse<R> = SuccessBody<R>;

/** The `data` payload of a response's successful branch */
export type EntityData<R> = SuccessBody<R> extends { data: infer D } ? D : never;

/** Parses a successful response body, or throws a `ProblemDetails` RFC 9457 error response. */
export async function parseAPIRes<R extends ResponseLike>(
	resPromise: R | Promise<R>,
): Promise<APIResponse<R>> {
	const res = await resPromise;

	if (!res.ok) {
		const body: unknown = await res.json().catch(() => null);

		throw ProblemDetails.catch({
			...problemDetails({ status: res.status }).problemDetails,
		}).parse(body);
	}

	const json: unknown = await res.json();
	if (!isSuccessBody<R>(json)) throw new Error('Invalid API response envelope');
	return json;
}

function isSuccessBody<R>(body: unknown): body is APIResponse<R> {
	return typeof body === 'object' && body !== null && 'data' in body;
}
