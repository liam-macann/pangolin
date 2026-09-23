import { Hono } from 'hono';
import { type DescribeRouteOptions, describeRoute } from 'hono-openapi';
import { standardSchemaProblemHook } from 'hono-problem-details/standard-schema';
import { z } from 'zod';

import { problemContract } from '@/api/errors/contract';
import { type Env, requireAuth } from '@/api/middleware';

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

export const validationHook = standardSchemaProblemHook();

const coerceToNumber = (value: unknown) =>
	typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export const paginationSchema = z.object({
	total: z.int32().nonnegative().readonly(),
	limit: z
		.preprocess(coerceToNumber, z.int32().positive().max(200))
		.default(200)
		.meta({
			description: 'Maximum number of items to return.',
			examples: [20],
		}),
	offset: z
		.preprocess(coerceToNumber, z.int32().nonnegative().max(100_000))
		.optional()
		.meta({
			description: 'Number of items to skip.',
			examples: [0],
		}),
});
