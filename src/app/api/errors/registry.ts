import { createProblemTypeRegistry } from 'hono-problem-details';

const PROBLEM_BASE = 'https://invoicer.internal/errors';

export const registry = {
	UNAUTHORIZED: {
		type: 'about:blank',
		status: 401,
		title: 'Authentication Required',
	},
	FORBIDDEN: {
		type: 'about:blank',
		status: 403,
		title: 'Not Permitted',
	},
	NOT_FOUND: {
		type: 'about:blank',
		status: 404,
		title: 'Resource Not Found',
	},
	METHOD_NOT_ALLOWED: {
		type: 'about:blank',
		status: 405,
		title: 'Method Not Allowed',
	},
	UPSTREAM_UNAVAILABLE: {
		type: `${PROBLEM_BASE}/upstream_unavailable`,
		status: 502,
		title: 'Upstream Unavailable',
	},
	INVALID_COUNTRY: {
		type: `${PROBLEM_BASE}/invalid_country`,
		status: 400,
		title: 'Invalid Country Code',
	},
} as const;

/** Registry of the API's domain error types, keyed for type-safe throwing via `problems.create()`. */
export const problems = createProblemTypeRegistry(registry, { autoCode: true });

/** Registered {@link problems} keys */
export type ProblemKey = Parameters<typeof problems.create>[0];

/** The literal HTTP status code a registered {@link ProblemKey} resolves to */
export type ProblemStatus<K extends ProblemKey> = (typeof registry)[K]['status'];
