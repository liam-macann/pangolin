import { createMiddleware } from 'hono/factory';

import { problems } from '@/api/errors';

import { getSession, type Session } from '@/auth';

export type Env = {
	Variables: {
		session: Session;
		/** Marks a response body as streamed, so hono.ts can skip body-buffering middleware (eg. etag) */
		streaming?: boolean;
	};
};

/** Throws a problem before opening a DB transaction when no session exists */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
	const session = await getSession();

	if (!session) throw problems.create('UNAUTHORIZED');

	c.set('session', session);
	await next();
});
