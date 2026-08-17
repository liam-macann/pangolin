import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { Config } from '@/api/dto/config';
import { fetchConfig } from '@/lib/data';

import { createApiRouter, defineRoute, problemContract } from './shared';

const route = defineRoute.protected({
	tags: ['Config'],
	operationId: 'getConfig',
	description: 'Return the active configuration.',
	responses: {
		200: {
			content: {
				'application/json': { schema: resolver(z.object({ data: Config })) },
			},
			description: 'Return the active configuration.',
		},
		...problemContract({}),
	},
});

const app = createApiRouter().get('/', ...route, async c => {
	const data = await fetchConfig();
	return c.json({ data }, 200);
});

export default app;
