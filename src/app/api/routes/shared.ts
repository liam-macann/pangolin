import { Hono } from 'hono';
import { type DescribeRouteOptions, describeRoute, resolver } from 'hono-openapi';
import { problemDetails } from 'hono-problem-details';
import { standardSchemaProblemHook } from 'hono-problem-details/standard-schema';
import { z } from 'zod';

import { ProblemDetails } from '@/api/errors';
import { type ProblemKey, type ProblemStatus, problems } from '@/api/errors/registry';
import { type Env, requireAuth } from '@/api/middleware';

export const createApiRouter = () => new Hono<Env>();

export const defineRoute = {
	protected: (config: DescribeRouteOptions) =>
		[describeRoute({ ...config, security: [{ SessionCookie: [] }] }), requireAuth] as const,
	public: (config: DescribeRouteOptions) => [describeRoute(config)] as const,
};

export const validationHook = standardSchemaProblemHook();

export const paginationSchema = z.object({
	total: z.int().nonnegative(),
	limit: z
		.preprocess(v => Number(v), z.int32().positive().max(100))
		.optional()
		.meta({
			description: 'Maximum number of items to return.',
			examples: [20],
		}),
	offset: z
		.preprocess(v => Number(v), z.int32().nonnegative())
		.optional()
		.meta({
			description: 'Number of items to skip.',
			examples: [0],
		}),
});

const problemDetailsResponse = (status: number, description?: string, schema = ProblemDetails) => ({
	content: {
		'application/problem+json': {
			schema: resolver(schema),
		},
	},
	description: description ?? `HTTP ${status} error.`,
});

type ProblemDetailsOpenAPI = ReturnType<typeof problemDetailsResponse>;

/** Resolves a ProblemKey to HTTP status code, allowing numeric codes to fall through */
type ProblemStatusOf<K extends PropertyKey> = K extends number
	? K
	: K extends ProblemKey
		? ProblemStatus<K>
		: never;

/** Renames each input key to resolved status code, mapping to a response */
type ProblemMap<T> = { [K in keyof T as ProblemStatusOf<K>]: ProblemDetailsOpenAPI };

/** Allows specifying problem errors from the registry, alongside a route-specific description
 * @remarks Includes middleware responses by default
 */
export const problemContract = <T extends Partial<Record<ProblemKey | number, string>>>(
	entries: T,
) => {
	const toEntry = (key: ProblemKey | number, description?: string) => {
		const example =
			typeof key === 'number' ? problemDetails({ status: key }).problemDetails : problems.get(key);

		return [
			example.status,
			problemDetailsResponse(
				example.status,
				description,
				ProblemDetails.meta({ title: 'ProblemDetails', examples: [example] }),
			),
		];
	};

	return Object.fromEntries([
		toEntry('UNAUTHORIZED', 'Authentication required.'),
		toEntry(500, 'Unexpected server error.'),

		...Object.keys(entries).map(rawKey => {
			const key = /^\d+$/.test(rawKey) ? Number(rawKey) : (rawKey as ProblemKey);
			return toEntry(key, entries[rawKey as keyof T] as string | undefined);
		}),
	]) as ProblemMap<T>;
};
