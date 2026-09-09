import { type Context } from 'hono';
import { problemDetailsHandler } from 'hono-problem-details';

import { problems } from './registry';

export * from './contract';
export { problems } from './registry';
export * from './schema';

const fallbackHandler = problemDetailsHandler({
	includeStack: process.env.NODE_ENV !== 'production',
});

/** Translates unexpected errors and Next.js access failures into RFC 9457 responses */
export function onError(error: Error, c: Context) {
	const ACCESS_FALLBACK_DIGEST = /^NEXT_HTTP_ERROR_FALLBACK;(401|403|404)$/;

	const digest = 'digest' in error && typeof error.digest === 'string' ? error.digest : undefined;
	const status = digest?.match(ACCESS_FALLBACK_DIGEST)?.[1];

	if (status === '401') return problems.create('UNAUTHORIZED').getResponse();
	if (status === '403') return problems.create('FORBIDDEN').getResponse();
	if (status === '404') return problems.create('NOT_FOUND').getResponse();

	return fallbackHandler(error, c);
}
