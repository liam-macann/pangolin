import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';

import { useInternalTableContext } from './context';

type DataTablePaginationControlsProps = {
	/** Whether controls should be hidden when there is only one page */
	conditional?: boolean;
};

export function DataTablePaginationControls({
	conditional = true,
}: DataTablePaginationControlsProps) {
	const table = useInternalTableContext();

	return (
		<table.Subscribe
			selector={state => ({
				columnFilters: state.columnFilters,
				globalFilter: state.globalFilter,
				pagination: state.pagination,
			})}
		>
			{({ pagination }) =>
				conditional && table.getPageCount() <= 1 ? null : (
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
							{pagination.pageIndex + 1}
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
				)
			}
		</table.Subscribe>
	);
}
