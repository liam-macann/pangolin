import { expectTypeOf, test } from 'vitest';
import { type z } from 'zod';

import { sortParam } from './sort';

test('Types sort terms from the field names', () => {
	const schema = sortParam(['position', 'label']);

	expectTypeOf<z.input<typeof schema>>().toEqualTypeOf<
		('position' | '-position' | 'label' | '-label')[]
	>();

	// @ts-expect-error: A default must name a sortable field
	schema.prefault(['-positon']);
});
