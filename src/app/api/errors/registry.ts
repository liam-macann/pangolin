import { createProblemTypeRegistry } from 'hono-problem-details';

const PROBLEM_BASE = 'https://pangolin.internal/errors';

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
	VALIDATION_ERROR: {
		type: `${PROBLEM_BASE}/validation_error`,
		status: 400,
		title: 'Validation Error',
	},
	INVALID_CURSOR: {
		type: `${PROBLEM_BASE}/invalid_cursor`,
		status: 422,
		title: 'Invalid Pagination Cursor',
	},
} as const;

/** Registry of the API domain error types, keyed for type-safe throwing via `problems.create()`. */
export const problems = createProblemTypeRegistry(registry, { autoCode: true });

/** Registered {@link problems} keys */
export type ProblemKey = Parameters<typeof problems.create>[0];

/** The literal HTTP status code a registered {@link ProblemKey} resolves to */
export type ProblemStatus<K extends ProblemKey> = (typeof registry)[K]['status'];
