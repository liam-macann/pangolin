'use client';
import { DotsThreeIcon, MagnifyingGlassIcon, StarIcon } from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { Data as ClientData } from '@/api/clients/route';
import { useClients } from '@/lib/hooks';
import { type ElementType, pluralize } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';

type Client = ElementType<ClientData>;

const columns: ColumnDef<Client>[] = [
	{
		accessorKey: 'name',
		header: 'Name',
	},
	{
		accessorKey: 'email',
		header: 'Email',
	},
	{
		accessorKey: 'invoiceCount',
		header: 'Invoices',
	},
];

export function Clients({ initial }: { initial: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	const favorites = data.filter(client => client.preferences.isFavourite);

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
								<h2 className='font-medium'>{client.name}</h2>
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

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: 'includesString',
		onGlobalFilterChange: setFilter,
		state: { globalFilter: filter },
	});

	return (
		<>
			<Input
				className='mb-6 h-10 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onChange={e => setFilter(e.target.value)}
				value={filter}
				prefix={<MagnifyingGlassIcon />}
			/>

			{table.getRowModel().rows?.length ? (
				<section className='grid grid-cols-4 gap-4'>
					{table.getRowModel().rows.map(client => (
						<div key={client.id} className='flex flex-col rounded-md border bg-card p-4'>
							<Button
								size='icon-sm'
								variant='ghost'
								className='-m-2 mb-4 self-end text-muted-foreground'
							>
								<DotsThreeIcon />
							</Button>
							<h2 className='font-medium'>{client.getValue('name')}</h2>
							<div className='flex justify-between'>
								<p className='text-muted-foreground text-sm'>
									{client.getValue('invoiceCount')}{' '}
									{pluralize(client.original.invoiceCount, 'invoice', 'invoices')}
								</p>
								<StarIcon
									weight={client.original.preferences.isFavourite ? 'fill' : undefined}
									className='text-muted-foreground'
								/>
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
