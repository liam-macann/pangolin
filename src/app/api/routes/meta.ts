import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { apiDocsPath, documentConfig } from '@/api/openapi';

import { createApiRouter, defineRoute, problemContract } from './shared';

const rootRoute = defineRoute.public({
	tags: ['Meta'],
	operationId: 'getApiRoot',
	description: 'Return basic information about the Invoicer API.',
	responses: {
		200: {
			content: {
				'application/json': {
					schema: resolver(
						z.object({
							name: z
								.string()
								.max(255)
								.meta({ examples: [documentConfig.info.title] }),
							description: z
								.string()
								.max(500)
								.meta({ examples: [documentConfig.info.description] }),
							documentation: z.url().max(2000),
						}),
					),
				},
			},
			description: 'Basic API information.',
		},
		...problemContract({}),
	},
});

const healthRoute = defineRoute.public({
	tags: ['Meta'],
	operationId: 'getHealth',
	description: 'Liveness check for the Invoicer API.',
	responses: {
		200: {
			content: {
				'application/health+json': {
					schema: resolver(
						z.object({
							status: z.enum(['pass', 'fail', 'warn']).meta({ examples: ['pass'] }),
						}),
					),
				},
			},
			description: 'The API is currently healthy and able to serve requests.',
		},
		...problemContract({}),
	},
});

const app = createApiRouter()
	.get('/', ...rootRoute, c =>
		c.json({
			name: documentConfig.info.title,
			description: documentConfig.info.description,
			documentation: new URL(apiDocsPath, c.req.url).toString(),
		}),
	)
	.get('/health', ...healthRoute, c =>
		c.json({ status: 'pass' }, 200, {
			'Content-Type': 'application/health+json',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
		}),
	);

export default app;
