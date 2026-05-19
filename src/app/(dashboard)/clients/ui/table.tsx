'use client';

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Data as ClientData } from '@/api/clients/route';
import { cn, type ElementType } from '@/lib/utils';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';

import { Card } from './card';

type Client = ElementType<ClientData>;

const columns: ColumnDef<Client>[] = [
	{
		accessorKey: 'isFavorite',
		id: 'isFavorite',
		filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
	},
	{
		accessorKey: 'data.name',
		header: 'Name',
	},
	{
		accessorKey: 'data.organization',
		header: 'Organisation',
	},
	{
		accessorKey: 'data.email',
		header: 'Email',
	},
	{
		accessorKey: 'invoiceCount',
		header: 'Invoices',
	},
];

export function Table({ data }: { data: Client[] }) {
	'use no memo';

	const router = useRouter();
	const [filter, setFilter] = useState('');
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
		{ id: 'isFavorite', value: false },
	]);

	const [isFiltering, setIsFiltering] = useState(false);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			globalFilter: filter,
			columnFilters,
		},
		initialState: {
			pagination: { pageSize: 40 },
		},
		onGlobalFilterChange: val => {
			setColumnFilters(val === '' ? [{ id: 'isFavorite', value: false }] : []);
			setFilter(val);
		},
		onColumnFiltersChange: setColumnFilters,
	});

	return (
		<>
			<InputGroup className='mb-6 grow rounded-full shadow-none'>
				<InputGroupAddon>
					<MagnifyingGlassIcon />
				</InputGroupAddon>
				<InputGroupInput
					aria-label='Search'
					placeholder='Search clients…'
					onChange={e => table.setGlobalFilter(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && e.currentTarget.value !== '') {
							const id = table.getRowModel().rows[0]?.original?.id;
							if (id) router.push(`/clients/${id}`);
						}
					}}
					onFocus={() => setIsFiltering(true)}
					onBlur={() => setIsFiltering(false)}
					value={filter}
				/>
			</InputGroup>

			{table.getRowModel().rows.length ? (
				<section className='grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
					<AnimatePresence mode='popLayout' initial={false}>
						{table.getRowModel().rows.map((client, i) => (
							<Card
								className={cn(
									i === 0 && isFiltering && filter !== '' && '[&>a]:border-ring [&>a]:ring-2',
								)}
								style={{ zIndex: table.getRowCount() - i }}
								key={client.original.id}
								client={client.original}
							/>
						))}
					</AnimatePresence>
				</section>
			) : (
				<div className='py-6 text-center text-muted-foreground'>No results</div>
			)}

			{table.getPageCount() > 1 && (
				<div className='mt-8 flex justify-end'>
					<ButtonGroup>
						<Button
							variant='secondary'
							size='sm'
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
							onClick={() => table.resetPageIndex()}
						>
							{table.getState().pagination.pageIndex + 1}
						</Button>
						<Button
							variant='secondary'
							size='sm'
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<span className='sr-only'>Next</span>
							<CaretRightIcon />
						</Button>
					</ButtonGroup>
				</div>
			)}
		</>
	);
}
