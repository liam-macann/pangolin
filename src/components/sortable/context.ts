import { type useSortable } from '@dnd-kit/react/sortable';
import { createContext } from 'react';

export type Item = { id: string };

export const SortableContext = createContext<{ items: Item[]; disabled: boolean }>({
	items: [],
	disabled: false,
});

export interface SortableItemContextValue {
	disabled: boolean;

	/** Returned methods from the useSortable hook */
	sortable: Pick<ReturnType<typeof useSortable>, 'isDragging' | 'handleRef'>;
}

export const SortableItemContext = createContext<SortableItemContextValue | null>(null);
