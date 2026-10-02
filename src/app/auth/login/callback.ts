import 'server-only';

import { z } from 'zod';

import { getAllowedHosts } from '@/lib/environment';

const relativeURL = z.string().refine(callbackUrl => {
	const RELATIVE_ORIGIN = 'https://invalid.sentinel';
	const resolved = URL.parse(callbackUrl, RELATIVE_ORIGIN);
	return /^\/(?!\/|\\|%2f|%5c)/i.test(callbackUrl) && resolved?.origin === RELATIVE_ORIGIN;
});

/** Permits absolute URLs with an internal origin */
const absoluteURL = z.url().refine(callbackUrl => {
	const origin = URL.parse(callbackUrl)?.origin;

	return getAllowedHosts().some(host => {
		const allowedOrigin = URL.parse(host.includes('://') ? host : `https://${host}`)?.origin;
		return origin !== undefined && origin === allowedOrigin;
	});
});

export const internalURL = z.union([relativeURL, absoluteURL]);
