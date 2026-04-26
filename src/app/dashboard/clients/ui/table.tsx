'use client';

import {
	CaretLeftIcon,
	CaretRightIcon,
	DotsThreeIcon,
	MagnifyingGlassIcon,
	StarIcon,
} from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Data as ClientData } from '@/api/clients/route';
import { cn, type ElementType, pluralize } from '@/lib/utils';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';
import { Toggle } from '@/ui/toggle';

import { OverflowMenu, useClientActions } from './menu';

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
							if (id) router.push(`/dashboard/clients/${id}`);
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

export function Card({
	client,
	className,
	ref,
	variant = 'outline',
	...props
}: {
	client: Client;
	ref?: React.Ref<HTMLDivElement>;
	variant?: 'secondary' | 'outline';
} & HTMLMotionProps<'div'>) {
	const { setFavorite } = useClientActions(client);

	return (
		<motion.div
			initial={{ scale: 0.95, opacity: 0, filter: 'blur(2px)', pointerEvents: 'none' }}
			animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', pointerEvents: 'auto' }}
			exit={{ scale: 0.95, opacity: 0, filter: 'blur(1px)', pointerEvents: 'none' }}
			transition={{
				default: { mass: 0.2, stiffness: 150, damping: 10, type: 'spring' },
				opacity: { duration: 0.2, ease: 'easeOut' },
				filter: { duration: 0.2, ease: 'easeOut' },
			}}
			key={client.id}
			layout='position'
			ref={ref}
			className={cn('relative flex flex-col', className)}
			{...props}
		>
			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<OverflowMenu
				side='left'
				align='start'
				client={client}
				render={
					<Button
						size='icon-xs'
						variant='ghost'
						className='absolute top-3 left-3 z-10 text-inherit'
					>
						<DotsThreeIcon />
					</Button>
				}
			/>

			<Link
				href={`clients/${client.id}`}
				className={cn(
					'!pt-12',
					'rounded-md border p-4 outline-none focus-visible:border-ring focus-visible:ring-2',
					'bg-card',
					variant === 'secondary' && 'bg-secondary',
				)}
			>
				<h2 className='line-clamp-1 break-all font-medium'>{client.data.name}</h2>
				<p
					style={{ textBox: 'trim-end cap alphabetic' }}
					className={cn(
						'text-sm opacity-70',
						'pr-6', // Optical alignment with star
					)}
				>
					{client.invoiceCount || 'No'} {pluralize(client.invoiceCount, 'invoice', 'invoices')}
				</p>
			</Link>

			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<Toggle
				pressed={client.isFavorite}
				onClick={e => e.stopPropagation}
				onPressedChange={setFavorite}
				size='icon-xs'
				variant='ghost'
				className={cn(
					'absolute right-3 bottom-3 translate-y-px',
					client.isFavorite && '!bg-transparent',
					'text-muted-foreground',
				)}
			>
				<span className='sr-only'>Favourite</span>
				<StarIcon
					weight={client.isFavorite ? 'fill' : undefined}
					className={cn('scale-95', client.isFavorite && 'text-primary')}
				/>
			</Toggle>
		</motion.div>
	);
}
