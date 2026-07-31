import { bytesToHex, randomBytes } from '@noble/ciphers/utils.js';
import { vi } from 'vitest';

// Implement from __mocks__ directory
// This provides a stable identity across test files, necessary with isolation disabled
vi.mock('next/cache');
vi.mock('next/navigation');

vi.stubEnv('DB_ENCRYPTION_SECRET', bytesToHex(randomBytes(32)));
