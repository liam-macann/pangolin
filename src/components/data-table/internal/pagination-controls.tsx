import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import { useInternalTableContext } from '@/components/data-table/internal/context';
import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';

type DataTablePaginationControlsProps = {
	/** Whether controls should be hidden when there is only one page */
	conditional?: boolean;
};

export function DataTablePaginationControls({
	conditional = true,
}: DataTablePaginationControlsProps) {
	const table = useInternalTableContext();

	if (conditional && table.getPageCount() <= 1) return null;

	return (
		<ButtonGroup>
			<Button
				variant='secondary'
				size='icon-sm'
				onClick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				<span className='sr-only'>Previous</span>
				<CaretLeftIcon />
			</Button>
			<Button
				variant='secondary'
				size='sm'
				className='bg-secondary px-2 font-medium text-muted-foreground text-sm tabular-nums'
				onClick={() => table.resetPageIndex(true)}
			>
				{table.state.pagination.pageIndex + 1}
			</Button>
			<Button
				variant='secondary'
				size='icon-sm'
				onClick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				<span className='sr-only'>Next</span>
				<CaretRightIcon />
			</Button>
		</ButtonGroup>
	);
}
