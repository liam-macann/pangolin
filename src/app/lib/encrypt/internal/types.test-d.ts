import { type UnknownRecord } from 'type-fest';
import { describe, expectTypeOf, test } from 'vitest';

import { type Decrypted, type Encrypted } from './types';

describe('Encrypted', () => {
	test('Is not assignable from a structurally identical object', () => {
		type Lookalike = Pick<Encrypted, keyof Encrypted>; // `keyof` omits the private brand
		expectTypeOf<Lookalike>().not.toExtend<Encrypted>();
	});
});

describe('Decrypted', () => {
	test('Replaces Encrypted values with string', () => {
		expectTypeOf<Decrypted<Encrypted>>().toEqualTypeOf<string>();
	});

	test('Leaves Encrypted-like objects unchanged', () => {
		type Lookalike = Pick<Encrypted, keyof Encrypted>;
		expectTypeOf<Decrypted<Lookalike>>().toEqualTypeOf<Lookalike>();
	});

	test('Leaves primitives unchanged', () => {
		expectTypeOf<Decrypted<string>>().toEqualTypeOf<string>();
		expectTypeOf<Decrypted<number>>().toEqualTypeOf<number>();
		expectTypeOf<Decrypted<null>>().toEqualTypeOf<null>();
		expectTypeOf<Decrypted<undefined>>().toEqualTypeOf<undefined>();
		expectTypeOf<Decrypted<Encrypted | null>>().toEqualTypeOf<string | null>();
	});

	test('Leaves any, unknown, and never unchanged', () => {
		// biome-ignore lint/suspicious/noExplicitAny: We are testing that any is not swallowed
		expectTypeOf<Decrypted<any>>().toBeAny();
		expectTypeOf<Decrypted<unknown>>().toBeUnknown();
		expectTypeOf<Decrypted<never>>().toBeNever();
	});

	test('Leaves non-record values unchanged', () => {
		expectTypeOf<Decrypted<Date>>().toEqualTypeOf<Date>();
		expectTypeOf<Decrypted<RegExp>>().toEqualTypeOf<RegExp>();
		expectTypeOf<Decrypted<Error>>().toEqualTypeOf<Error>();
		expectTypeOf<Decrypted<Headers>>().toEqualTypeOf<Headers>();
		expectTypeOf<Decrypted<Blob>>().toEqualTypeOf<Blob>();
		expectTypeOf<Decrypted<URL>>().toEqualTypeOf<URL>();
		expectTypeOf<Decrypted<URLSearchParams>>().toEqualTypeOf<URLSearchParams>();
		expectTypeOf<Decrypted<ArrayBuffer>>().toEqualTypeOf<ArrayBuffer>();
		expectTypeOf<Decrypted<Uint8Array>>().toEqualTypeOf<Uint8Array>();

		type Weak = WeakMap<object, Encrypted>;
		expectTypeOf<Decrypted<Weak>>().toEqualTypeOf<Weak>();
		expectTypeOf<Decrypted<WeakSet<Encrypted>>>().toEqualTypeOf<WeakSet<Encrypted>>();
		expectTypeOf<Decrypted<WeakRef<Encrypted>>>().toEqualTypeOf<WeakRef<Encrypted>>();

		expectTypeOf<Decrypted<Promise<Encrypted>>>().toEqualTypeOf<Promise<Encrypted>>();
		expectTypeOf<Decrypted<() => Encrypted>>().toEqualTypeOf<() => Encrypted>();
	});

	test('Does not expand built-in types', () => {
		// Decrypted distributes over the union, checking each built-in separately
		type Subclassed = { secret: Encrypted } & (
			| Date
			| RegExp
			| Error
			| Headers
			| Blob
			| URL
			| URLSearchParams
			| ArrayBuffer
			| Uint8Array
			| WeakMap<object, Encrypted>
			| WeakSet<Encrypted>
			| WeakRef<Encrypted>
			| Promise<Encrypted>
			| Generator<Encrypted>
		);

		expectTypeOf<Decrypted<Subclassed>>().toEqualTypeOf<Subclassed>();
	});

	describe('Arrays', () => {
		test('Walks through element types', () => {
			expectTypeOf<Decrypted<Encrypted[]>>().toEqualTypeOf<string[]>();
			expectTypeOf<Decrypted<(Encrypted | number)[]>>().toEqualTypeOf<(string | number)[]>();
		});

		test('Preserves tuple positions', () => {
			expectTypeOf<Decrypted<[Encrypted, number]>>().toEqualTypeOf<[string, number]>();
			type Tuple = Decrypted<[Encrypted, [Date, Encrypted]]>;
			expectTypeOf<Tuple>().toEqualTypeOf<[string, [Date, string]]>();
		});

		test('Preserves readonly', () => {
			expectTypeOf<Decrypted<readonly Encrypted[]>>().toEqualTypeOf<readonly string[]>();
			type Tuple = Decrypted<readonly [Encrypted, Date]>;
			expectTypeOf<Tuple>().toEqualTypeOf<readonly [string, Date]>();
		});
	});

	test('Walks through Set values', () => {
		expectTypeOf<Decrypted<Set<Encrypted>>>().toEqualTypeOf<Set<string>>();
		expectTypeOf<Decrypted<ReadonlySet<Encrypted>>>().toEqualTypeOf<ReadonlySet<string>>();
	});

	test('Walks through Map keys and values', () => {
		expectTypeOf<Decrypted<Map<Encrypted, Encrypted[]>>>().toEqualTypeOf<Map<string, string[]>>();
		expectTypeOf<Decrypted<ReadonlyMap<Encrypted, Encrypted>>>().toEqualTypeOf<
			ReadonlyMap<string, string>
		>();
	});

	describe('Objects', () => {
		test('Maps property types', () => {
			expectTypeOf<Decrypted<{ property: Encrypted }>>().toEqualTypeOf<{ property: string }>();
		});

		test('Maps index signatures', () => {
			expectTypeOf<Decrypted<Record<string, Encrypted>>>().toEqualTypeOf<Record<string, string>>();
		});

		test('Maps objects that structurally satisfy a built-in', () => {
			type Notice = { name: string; message: string; body: Encrypted };
			type Expected = { name: string; message: string; body: string };

			expectTypeOf<Notice>().toExtend<Error>();
			expectTypeOf<Decrypted<Notice>>().toEqualTypeOf<Expected>();
		});

		test('Preserves nominal class instances', () => {
			class NominalClassInstance {
				#brand = true;
				secret!: Encrypted;

				isNominal() {
					return this.#brand;
				}
			}

			expectTypeOf<Decrypted<NominalClassInstance>>().toEqualTypeOf<NominalClassInstance>();
		});

		// Mirrors isPlainObject(), which rejects any object with a custom tag
		test('Preserves tagged class instances', () => {
			class TaggedClassInstance {
				secret!: Encrypted;

				get [Symbol.toStringTag]() {
					return 'Tagged';
				}
			}

			expectTypeOf<Decrypted<TaggedClassInstance>>().toEqualTypeOf<TaggedClassInstance>();
		});

		// Documents mismatch: Classes are not plain objects, and so fall through at runtime
		test('Conservatively maps structurally typed class properties', () => {
			class ClassInstance {
				secret!: Encrypted;
			}

			expectTypeOf<Decrypted<ClassInstance>>().toEqualTypeOf<{ secret: string | Encrypted }>();
		});

		// Documents the unindexed-interface mismatch: type does not match runtime
		test('Conservatively maps properties of unindexed interfaces', () => {
			interface ObjectInterface {
				secret: Encrypted;
				nested: { deep: Encrypted };
				list: Encrypted[];
			}

			expectTypeOf<Decrypted<ObjectInterface>>().toEqualTypeOf<{
				secret: string | Encrypted;
				nested: { deep: string | Encrypted };
				list: (string | Encrypted)[];
			}>();
		});

		test('Maps interfaces that opt into record semantics', () => {
			interface RecordInterface extends UnknownRecord {
				secret: Encrypted;
			}

			interface DecryptedRecordInterface extends UnknownRecord {
				secret: string;
			}

			expectTypeOf<Decrypted<RecordInterface>>().toEqualTypeOf<DecryptedRecordInterface>();
		});

		test('Preserves optional properties', () => {
			expectTypeOf<Decrypted<{ optional?: Encrypted }>>().toEqualTypeOf<{ optional?: string }>();
		});

		test('Preserves readonly', () => {
			expectTypeOf<Decrypted<{ readonly a: Encrypted }>>().toEqualTypeOf<{ readonly a: string }>();
		});

		test('Walks through deeply nested values', () => {
			expectTypeOf<
				Decrypted<{ list: [Encrypted, { deep: Set<Encrypted> }]; at: Date }>
			>().toEqualTypeOf<{ list: [string, { deep: Set<string> }]; at: Date }>();
		});
	});
});
