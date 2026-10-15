import { expectTypeOf, test } from 'vitest';

import { createOptimisticResource } from './resource';

type Entity = { id: string; favorite: boolean };

const resource = createOptimisticResource<Entity>({
	mutationKey: ['entities'],
	invalidates: () => [],
});

const applyUpdate = (entities: Entity[], update: (entity: Entity) => Entity) =>
	entities.map(update);

test('Preserves the selected return type', () => {
	const select = resource.useOptimisticSelect(applyUpdate, entities => entities.length);

	expectTypeOf(select).toEqualTypeOf<(response: Entity[]) => number>();
});

test('Preserves the response type without a selector', () => {
	const select = resource.useOptimisticSelect(applyUpdate);

	expectTypeOf(select).toEqualTypeOf<(response: Entity[]) => Entity[]>();
});

test('Preserves the response type with an undefined selector', () => {
	const select = resource.useOptimisticSelect(applyUpdate, undefined);

	expectTypeOf(select).toEqualTypeOf<(response: Entity[]) => Entity[]>();
});

test('Includes the response type when a selector may be absent', () => {
	function useSelect(selector?: (entities: Entity[]) => number) {
		return resource.useOptimisticSelect(applyUpdate, selector);
	}

	expectTypeOf(useSelect).returns.toEqualTypeOf<(response: Entity[]) => Entity[] | number>();
});
