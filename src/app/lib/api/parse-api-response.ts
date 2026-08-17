import { type ClientResponse } from 'hono/client';
import { type StatusCode, type SuccessStatusCode } from 'hono/utils/http-status';
import { problemDetails } from 'hono-problem-details';

import { ProblemDetails } from '@/api/errors';

/** The JSON body of a response's successful (2xx) branch. */
type SuccessBody<R> =
	R extends ClientResponse<infer Body, infer Status, string>
		? Status extends SuccessStatusCode
			? Body
			: never
		: never;

/** The unwrapped `data` payload of a response's successful branch. */
export type EntityData<R> = SuccessBody<R> extends { data: infer D } ? D : never;

/** Unwraps a successful `{ data }` response envelope, or throws `ProblemDetails` RFC 9457 error response */
export async function parseAPIRes<R extends ClientResponse<unknown, StatusCode, string>>(
	resPromise: R | Promise<R>,
): Promise<EntityData<R>> {
	const res = await resPromise;

	if (!res.ok) {
		const body: unknown = await res.json().catch(() => null);

		throw ProblemDetails.catch({
			...problemDetails({ status: res.status }).problemDetails,
		}).parse(body);
	}

	const json = (await res.json()) as SuccessBody<R>;
	return (json as { data: EntityData<R> }).data;
}
