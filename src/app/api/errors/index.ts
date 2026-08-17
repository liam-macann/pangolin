import { kebabCase } from 'es-toolkit/compat';
import { type Context } from 'hono';
import { problemDetailsHandler } from 'hono-problem-details';
import { type KebabCase } from 'type-fest';
import { z } from 'zod';

import { problems } from './registry';

export { problems } from './registry';

export const ProblemDetails = z
	.looseObject({
		/** Problem type URI. Default: "about:blank" */
		type: z.url().max(2000).default('about:blank').meta({ description: 'Problem type URI' }),
		/** Short summary of the problem type */
		title: z.string().max(255).meta({ description: 'Short summary of the problem type' }),
		/** HTTP status code */
		status: z.int().min(100).max(599).meta({ description: 'HTTP status code' }),
		/** Human-readable explanation specific to this occurrence */
		detail: z.string().max(2000).optional().meta({ description: 'Human-readable explanation' }),
		/** URI that identifies the specific occurrence */
		instance: z.url().max(2000).optional().meta({ description: 'URI identifying the occurrence' }),

		//
		// EXTENSIONS

		/** Machine-readable error code, derived from the registry key that produced this response */
		code: z
			.enum(problems.types().map(<S extends string>(key: S) => kebabCase(key) as KebabCase<S>))
			.optional(),
	})
	.meta({ title: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof ProblemDetails>;

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
