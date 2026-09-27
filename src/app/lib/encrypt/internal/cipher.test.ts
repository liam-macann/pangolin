import { describe, expect, test } from 'vitest';

import { decoder } from './cipher';

describe('decoder', () => {
	test('Throws on invalid UTF-8 rather than substituting U+FFFD', () => {
		expect(() => decoder.decode(new Uint8Array([0xff]))).toThrow();
	});
});
