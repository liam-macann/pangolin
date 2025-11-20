'use client';

import { DotsThreeIcon, MagnifyingGlassIcon, StarIcon } from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Data as ClientData } from '@/api/clients/route';
import { updateClientFavorite } from '@/lib/actions/client';
import { useClients } from '@/lib/hooks';
import { type ElementType, pluralize } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Toggle } from '@/ui/toggle';

type Client = ElementType<ClientData>;

const columns: ColumnDef<Client>[] = [
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
	const favorites = data.filter(client => client.isFavourite);

	return (
		<>
			{favorites.length > 0 && (
				<>
					<h1 className='mb-3 font-semibold text-lg'>Pinned</h1>
					<section className='grid grid-cols-4 gap-4'>
						{favorites.map(client => (
							<div
								key={client.id}
								className='rounded-md border border-gray-12/30 bg-primary p-4 pt-8 text-primary-foreground'
							>
								<h2 className='font-medium'>{client.data.name}</h2>
								<p className='text-primary-foreground text-sm'>
									{client.invoiceCount} {pluralize(client.invoiceCount, 'invoice', 'invoices')}
								</p>
							</div>
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
	const { mutate } = useClients();

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onGlobalFilterChange: setFilter,
		state: { globalFilter: filter },
	});

	return (
		<>
			<Input
				className='mb-6 h-10 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onChange={e => table.setGlobalFilter(String(e.target.value))}
				value={filter}
				prefix={<MagnifyingGlassIcon />}
			/>

			{table.getRowModel().rows?.length ? (
				<section className='grid grid-cols-4 gap-4'>
					{table.getRowModel().rows.map(client => (
						<div key={client.id} className='flex flex-col gap-y-0.5 rounded-md border bg-card p-4'>
							<Button
								size='icon-sm'
								variant='ghost'
								className='-m-2 mb-2 self-end text-muted-foreground'
							>
								<DotsThreeIcon />
							</Button>
							<h2 className='font-medium'>{client.original.data.name}</h2>
							<div className='flex justify-between'>
								<p className='text-muted-foreground text-sm'>
									{client.getValue('invoiceCount')}{' '}
									{pluralize(client.original.invoiceCount, 'invoice', 'invoices')}
								</p>
								<Toggle
									pressed={client.original.isFavourite}
									onPressedChange={v => {
										const id = client.original.id;
										mutate(
											async curr => {
												await updateClientFavorite(id, v).catch(err => {
													toast.error('Failed to update client. Please try again later.');
													throw err;
												});

												// Function does not return. On success, use optimistic data. Fallable if multiple operations are queued.
												return curr
													? curr.map(item => (item.id === id ? { ...item, isFavourite: v } : item))
													: [];
											},
											{
												optimisticData: curr =>
													curr
														? curr.map(item =>
																item.id === id ? { ...item, isFavourite: v } : item,
															)
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
										weight={client.original.isFavourite ? 'fill' : undefined}
										className='text-muted-foreground'
									/>
								</Toggle>
							</div>
						</div>
					))}
				</section>
			) : (
				<div className='py-6 text-center text-muted-foreground'>No results</div>
			)}
		</>
	);
}
