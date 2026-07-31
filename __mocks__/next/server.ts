import { vi } from 'vitest';

export * from 'next/server';

export const after = vi.fn((callback: () => unknown) => callback());
