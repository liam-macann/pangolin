import { Hono, type ValidationTargets } from 'hono';
import {
	// biome-ignore lint/style/noRestrictedImports: Wrapped here as a domain validator used by routes
	validator as baseValidator,
	type DescribeRouteOptions,
	describeRoute,
} from 'hono-openapi';
import { standardSchemaProblemHook } from 'hono-problem-details/standard-schema';
import { z } from 'zod';

import { problemContract } from '@/api/errors/contract';
import { type Env, requireAuth } from '@/api/middleware';
import { Cursor } from '@/api/pagination';
import { queryParams } from '@/api/query';

export const createApiRouter = () => new Hono<Env>();

export const defineRoute = {
	protected: (config: DescribeRouteOptions) =>
		[
			describeRoute({
				...config,
				security: [{ SessionCookie: [] }],
				responses: {
					...problemContract({
						401: {
							description: 'Authentication is required.',
							problems: ['UNAUTHORIZED'],
						},
					}),
					...config.responses,
				},
			}),
			requireAuth,
		] as const,
	public: (config: DescribeRouteOptions) => [describeRoute({ ...config, security: [{}] })] as const,
};

export const validator = <TTarget extends keyof ValidationTargets, TSchema extends z.ZodObject>(
	target: TTarget,
	schema: TSchema,
) =>
	baseValidator(
		target,
		target === 'query' ? queryParams(schema) : schema,
		standardSchemaProblemHook(),
	);

const coerceToNumber = (value: unknown) =>
	typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export const paginationQuerySchema = z.object({
	limit: z
		.preprocess(coerceToNumber, z.int32().positive().max(200))
		.default(200)
		.meta({
			description: 'Maximum number of items to return.',
			examples: [20],
		}),
	cursor: Cursor.optional(),
});

export const paginationMetaSchema = z.object({
	limit: z
		.int32()
		.positive()
		.max(200)
		.meta({
			description: 'The maximum number of items that could be returned in this query.',
			examples: [20],
		}),
	nextCursor: Cursor.nullable(),
});
