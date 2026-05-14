import { vi } from 'vitest';

// Allow server-only files to be imported outside of Next.js server context
vi.mock('server-only', () => ({}));
