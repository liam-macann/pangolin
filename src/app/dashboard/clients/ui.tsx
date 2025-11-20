'use client';

import { DotsThreeIcon, MagnifyingGlassIcon, StarIcon } from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Data as ClientData } from '@/api/clients/route';
import { updateClientFavorite } from '@/lib/actions/client';
import { useClients } from '@/lib/hooks';
import { cn, type ElementType, pluralize } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Toggle } from '@/ui/toggle';

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

export function Clients({ initial }: { initial: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	const favorites = data.filter(client => client.isFavorite);

	return (
		<>
			{favorites.length > 0 && (
				<>
					<h1 className='mb-3 font-semibold text-lg'>Pinned</h1>
					<section className='grid grid-cols-4 gap-4'>
						{favorites.map(client => (
							<Card
								key={client.id}
								client={client}
								className='border-black/20 bg-primary **:text-primary-foreground'
							/>
						))}
					</section>

					<hr className='my-12' />
				</>
			)}

			<Table data={data} />
		</>
	);
}

export function Table({ data }: { data: Client[] }) {
	const [filter, setFilter] = useState('');
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
		{ id: 'isFavorite', value: false },
	]);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			globalFilter: filter,
			columnFilters,
		},
		onGlobalFilterChange: val => {
			setColumnFilters(val === '' ? [{ id: 'isFavorite', value: false }] : []);
			setFilter(val);
		},
		onColumnFiltersChange: setColumnFilters,
	});

	return (
		<>
			<Input
				className='mb-6 h-10 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onChange={e => table.setGlobalFilter(e.target.value)}
				value={filter}
				prefix={<MagnifyingGlassIcon />}
			/>

			{table.getRowModel().rows.length ? (
				<section className='grid grid-cols-4 gap-4'>
					{table.getRowModel().rows.map(client => (
						<Card key={client.id} client={client.original} />
					))}
				</section>
			) : (
				<div className='py-6 text-center text-muted-foreground'>No results</div>
			)}
		</>
	);
}

function Card({ client, className }: { client: Client; className?: string }) {
	const { mutate } = useClients();

	return (
		<div
			key={client.id}
			className={cn('flex flex-col gap-y-0.5 rounded-md border bg-card p-4', className)}
		>
			<Button size='icon-sm' variant='ghost' className='-m-2 mb-2 self-end text-muted-foreground'>
				<DotsThreeIcon />
			</Button>
			<h2 className='font-medium'>{client.data.name}</h2>
			<div className='flex justify-between'>
				<p className='text-muted-foreground text-sm'>
					{client.invoiceCount} {pluralize(client.invoiceCount, 'invoice', 'invoices')}
				</p>
				<Toggle
					pressed={client.isFavorite}
					onPressedChange={v => {
						const id = client.id;
						mutate(
							async curr => {
								await updateClientFavorite(id, v).catch(err => {
									toast.error('Failed to update client. Please try again later.');
									throw err;
								});

								return curr?.map(item => (item.id === id ? { ...item, isFavorite: v } : item));
							},
							{
								optimisticData: curr =>
									curr
										? curr.map(item => (item.id === id ? { ...item, isFavorite: v } : item))
										: [],
							},
						);
					}}
					size='icon-sm'
					variant='ghost'
					className='-m-2 !bg-transparent'
				>
					<span className='sr-only'>Favourite</span>
					<StarIcon
						weight={client.isFavorite ? 'fill' : undefined}
						className='text-muted-foreground'
					/>
				</Toggle>
			</div>
		</div>
	);
}
