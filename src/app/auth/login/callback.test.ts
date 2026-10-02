import { assert, expect, test } from 'vitest';

import { getAllowedHosts } from '@/lib/environment';

import { internalURL } from './callback';

const allowedHosts = getAllowedHosts();
assert(allowedHosts.length > 0, 'Expected at least one allowed host');

test.for(['/', '/invoices', '/invoices/123?tab=preview#totals', '/invoices?next=%2Fclients'])(
	'Accepts relative URL %s',
	input => {
		const result = internalURL.safeParse(input);
		expect(result).toEqual({ success: true, data: input });
	},
);

test.for(allowedHosts)('Accepts an absolute URL for %s', host => {
	const origin = URL.parse(host.includes('://') ? host : `https://${host}`)?.origin;
	assert(origin, 'Expected the allowed host to resolve to an origin');

	const callbackUrl = new URL('/clients?favorite=true#list', origin).href;
	const result = internalURL.safeParse(callbackUrl);

	expect(result).toEqual({ success: true, data: callbackUrl });
});

test.for([
	'https://malicious.example',
	'//malicious.example',
	'//localhost:3000/clients',
	'/\\malicious.example',
	'/%2fmalicious.example',
	'invoices',
])('Rejects unsafe callback URL %s', input => {
	expect(internalURL.validate(input)).toBe(false);
});

test('Rejects an absent or repeated callback URL', () => {
	expect(internalURL.validate(undefined)).toBe(false);
});

test('Rejects a repeated callback URL', () => {
	expect(internalURL.validate(['/clients', '/invoices'])).toBe(false);
});
