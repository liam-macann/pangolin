import { toMerged } from 'es-toolkit/object';

import { type PartialDeep } from '@/lib/utils/type';

/** Creates a test-data builder that deep-merges overrides onto a fresh base value */
export const createBuilder =
	<T extends Record<PropertyKey, unknown>>(base: () => T) =>
	(overrides?: PartialDeep<T>): T =>
		toMerged(base(), overrides ?? {});
