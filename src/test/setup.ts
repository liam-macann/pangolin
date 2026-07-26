import { bytesToHex, randomBytes } from '@noble/ciphers/utils.js';
import { vi } from 'vitest';

// Allow server-only files to be imported outside of Next.js server context
vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({ updateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn((cb: () => unknown) => cb()) }));

// Keeps the actual implementations, but wraps them so we can assert they were called
vi.mock(import('next/navigation'), async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		notFound: vi.fn(actual.notFound),
		unauthorized: vi.fn(actual.unauthorized),
		forbidden: vi.fn(actual.forbidden),
	};
});

vi.stubEnv('DB_ENCRYPTION_SECRET', bytesToHex(randomBytes(32)));
