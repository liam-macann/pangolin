import '@/src/styles/global.css';

import { bytesToHex, randomBytes } from '@noble/ciphers/utils.js';
import { vi } from 'vitest';

// Implement from __mocks__ directory
// This provides a stable identity across test files, necessary with isolation disabled
vi.mock('next/cache');
vi.mock('next/navigation');

vi.stubEnv('DB_ENCRYPTION_SECRET', bytesToHex(randomBytes(32)));

// unauthorized() and forbidden() are gated behind this experimental flag, enabled in next.config.ts
vi.stubEnv('__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS', 'true');
