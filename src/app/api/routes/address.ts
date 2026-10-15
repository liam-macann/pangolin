import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { AddressMetadata, country } from '@/api/dto/address';
import { problemContract } from '@/api/errors';
import { fetchAddressMetadata } from '@/lib/utils/address';

import { createApiRouter, defineRoute, validator } from './shared';

const params = z.object({
	country: country.meta({
		description: 'ISO 3166-1 alpha-2 country or territory code.',
		examples: ['US'],
	}),
});

const route = defineRoute.public({
	tags: ['Address'],
	operationId: 'getAddressMetadata',
	description: 'Return address format metadata for a country.',
	responses: {
		200: {
			content: {
				'application/json': { schema: resolver(z.object({ data: AddressMetadata })) },
			},
			description: 'Return address format metadata for a country.',
		},
		...problemContract({}),
	},
});

const app = createApiRouter().get(
	'/metadata/:country',
	...route,
	validator('param', params),
	async c => {
		const { country } = c.req.valid('param');

		const data = await fetchAddressMetadata(country);
		c.header('Cache-Control', `public, max-age=${86400 * 2}, stale-while-revalidate=${86400 * 7}`);

		return c.json({ data }, 200);
	},
);

export default app;
