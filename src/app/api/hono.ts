import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { etag as _etag } from 'hono/etag';
import { logger } from 'hono/logger';
import { methodNotAllowed } from 'hono/method-not-allowed';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timeout } from 'hono/timeout';
import { trimTrailingSlash } from 'hono/trailing-slash';

import { getOpenApiDocument as _getOpenApiDocument } from '@/api/openapi';

import { onError, problems } from './errors';
import { type Env } from './middleware';
import address from './routes/address';
import avatar from './routes/avatar';
import clients from './routes/clients';
import config from './routes/config';
import invoices from './routes/invoices';
import meta from './routes/meta';

const routes = new Hono()
	.route('/', meta)
	.route('/config', config)
	.route('/clients', clients)
	.route('/invoices', invoices)
	.route('/address', address)
	.route('/avatar', avatar);

export type AppType = typeof routes;
export { routes };

const app = new Hono<Env>({ strict: false }).basePath('/api').onError(onError);

if (process.env.NODE_ENV !== 'test') app.use(logger());
app.use(secureHeaders());
app.use(
	cors({
		origin: [
			process.env.VERCEL_URL,
			process.env.VERCEL_BRANCH_URL,
			process.env.VERCEL_PROJECT_PRODUCTION_URL,
			process.env.BETTER_AUTH_URL,
		]
			.filter((v): v is string => typeof v === 'string')
			.map(url => (url.startsWith('http') ? url : `https://${url}`)),
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
	}),
);
app.use(
	methodNotAllowed({
		app,
		onMethodNotAllowed: (_c, methods) => {
			const res = problems.create('METHOD_NOT_ALLOWED').getResponse();
			res.headers.set('Allow', methods.join(', '));
			return res;
		},
	}),
);
app.use(prettyJSON());
app.use(trimTrailingSlash({ alwaysRedirect: true }));
const etag = _etag();
app.use(async (c, next) => {
	await next();
	// Skips responses declared as streamed: etag() buffers the whole body
	if (!c.get('streaming')) await etag(c, async () => {});
});
app.use(timeout(30 * 1000));

app.route('/', routes);
app.notFound(() => problems.create('NOT_FOUND').getResponse());

export const getOpenApiDocument = () => _getOpenApiDocument(routes);
app.get('/openapi.json', async c => c.json(await getOpenApiDocument()));

export default app;
