import { customType } from 'drizzle-orm/pg-core';

import { Encrypted } from './internal/types';

export const encrypted = customType<{
	data: Encrypted;
	driverData: Uint8Array | Buffer | string;
}>({
	dataType: () => 'bytea',
	toDriver(value: Encrypted): Buffer {
		if (!(value instanceof Encrypted)) throw new Error('Value is not encrypted');

		// Buffer necessary to support both Neon driver and PGLite
		return Buffer.from(value.serialize());
	},
	fromDriver(value): Encrypted {
		// Conservatively handle DB driver behaviour with union type
		const bytes = (): Uint8Array => {
			// Also matches Buffer, a Uint8Array subclass
			if (value instanceof Uint8Array) return value;

			// If hex encoded string
			if (!value.startsWith('\\x')) throw new Error('String is not hex encoded');

			return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
		};

		return Encrypted.deserialize(bytes());
	},
});
