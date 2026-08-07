import { cn } from '@/lib/utils';

import { Empty } from '@/ui/empty';

/** Visible when there are no items in the sortable list */
export function SortableEmpty({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<Empty
			data-slot='empty'
			className={cn(
				'flex flex-row justify-between border p-6 py-7 group-not-data-empty/sortable:hidden',
				className,
			)}
			{...props}
		/>
	);
}
