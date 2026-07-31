import { vi } from 'vitest';

export * from 'next/cache';

export const updateTag = vi.fn();
export const cacheLife = vi.fn();
export const cacheTag = vi.fn();
