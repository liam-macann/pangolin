import * as actual from 'next/navigation';
import { vi } from 'vitest';

export * from 'next/navigation';

export const notFound = vi.fn(actual.notFound);
export const forbidden = vi.fn(actual.forbidden);
export const unauthorized = vi.fn(actual.unauthorized);
