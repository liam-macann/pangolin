import { equalBytes } from '@noble/ciphers/utils.js';

import { header } from '@/lib/encrypt/constants';

export const isEncrypted = (value: Uint8Array): boolean => equalBytes(value.slice(0, 3), header);
