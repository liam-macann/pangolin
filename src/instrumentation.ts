import * as Sentry from '@sentry/nextjs';

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		await import('./../sentry.server.config');
	}

	if (process.env.NEXT_RUNTIME === 'edge') {
		await import('./../sentry.edge.config');
	}

	if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
		const { ServerEventBus } = await import('@tanstack/devtools-event-bus/server');
		const bus = new ServerEventBus();
		await bus.start();
	}
}

export const onRequestError = Sentry.captureRequestError;
