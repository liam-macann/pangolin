import { equalBytes } from '@noble/ciphers/utils.js';

import { header } from '@/lib/encrypt/constants';
import { type Brand } from '@/lib/utils';

export const isEncrypted = (value: Uint8Array): value is Encrypted =>
	equalBytes(value.slice(0, 3), header);

export type Encrypted = Brand<Uint8Array, 'Encrypted'>;
