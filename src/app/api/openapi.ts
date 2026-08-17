import { type Env, type Hono, type Schema } from 'hono';
import { generateSpecs } from 'hono-openapi';

import { auth } from '@/auth';

const documentConfig = {
	openapi: '3.1.0',
	info: {
		title: 'Invoicer API',
		version: 'unstable_internal',
		description: 'Internal REST API for the Invoicer dashboard.',
	},
	servers: [{ url: '/api', description: 'Base URL for the Invoicer API.' }],
	tags: [
		{ name: 'Address', description: 'Address metadata operations.' },
		{ name: 'Clients', description: 'Client directory operations.' },
		{ name: 'Config', description: 'User configuration operations.' },
		{ name: 'Invoices', description: 'Invoice listing operations.' },
	],
};

export async function getOpenApiDocument(routes: Hono<Env, Schema, '/'>) {
	const authContext = await auth.$context;

	return generateSpecs(routes, {
		documentation: {
			...documentConfig,
			components: {
				securitySchemes: {
					SessionCookie: {
						type: 'apiKey',
						in: 'cookie',
						name: authContext.authCookies.sessionToken.name,
						description: 'Authentication via ambient session cookie',
					},
				},
			},
		},
	});
}
