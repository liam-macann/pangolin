'use client';

import { UserCirclePlusIcon } from '@phosphor-icons/react';
import { UserRectangleIcon } from '@phosphor-icons/react/dist/ssr';
import { type ColumnDef, type ColumnFiltersState } from '@tanstack/react-table';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Data as ClientData } from '@/api/clients/route';
import { useClients } from '@/lib/hooks';
import { cn, type ElementType } from '@/lib/utils';

import { createDataTable, type DataTableFeatures } from '@/components/data-table';
import { MaintainHeight } from '@/components/maintain-height';
import { Button } from '@/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/ui/empty';

import { CreateClientDialog } from './../ui/dialogs';
import { Card } from './card';

type Client = ElementType<ClientData>;

export function Clients({ initial }: { initial: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	const favorites = data.filter(client => client.isFavorite);

	return (
		<div className='w-full'>
			<div className='mb-8 flex w-full items-baseline justify-between'>
				<h1 className='font-display text-3xl'>Clients</h1>
				<CreateClientDialog>
					<Button variant='outline'>
						<UserCirclePlusIcon />
						<span className='hidden sm:block'>New client</span>
					</Button>
				</CreateClientDialog>
			</div>
			{favorites.length > 0 && (
				<>
					<section className='no-scrollbar flex snap-x gap-4 max-lg:-mx-6 max-lg:scroll-px-6 max-lg:overflow-scroll max-lg:px-6 lg:grid lg:grid-cols-4'>
						<AnimatePresence mode='popLayout' initial={false}>
							{favorites.map(client => (
								<Card
									key={client.id}
									client={client}
									className='shrink-0 basis-60 snap-start max-lg:max-w-[90%]'
									variant='secondary'
								/>
							))}
						</AnimatePresence>
					</section>

					<hr className='my-12' />
				</>
			)}

			<MaintainHeight>
				<Table data={data} />
			</MaintainHeight>
		</div>
	);
}

const columns: ColumnDef<DataTableFeatures, Client>[] = [
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

const ClientTable = createDataTable(columns);

function Table({ data }: { data: Client[] }) {
	const router = useRouter();

	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
		{ id: 'isFavorite', value: false },
	]);

	const [isFiltering, setIsFiltering] = useState(false);

	return (
		<ClientTable.Root
			data={data}
			initialState={{ pagination: { pageSize: 40 } }}
			state={{
				columnFilters,
			}}
			onGlobalFilterChange={val => {
				setColumnFilters(val === '' ? [{ id: 'isFavorite', value: false }] : []);
			}}
			onColumnFiltersChange={setColumnFilters}
		>
			<ClientTable.Search
				className='mb-6 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onKeyDown={(e, table) => {
					if (e.key === 'Enter' && e.currentTarget.value !== '') {
						const id = table.getRowModel().rows[0]?.original?.id;
						if (id) router.push(`/clients/${id}`);
					}
				}}
				onFocus={() => setIsFiltering(true)}
				onBlur={() => setIsFiltering(false)}
			/>

			{data.length > 0 ? (
				<ClientTable.Content>
					{table =>
						table.getRowModel().rows.length ? (
							<section className='grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
								<AnimatePresence mode='popLayout' initial={false}>
									{table.getRowModel().rows.map((client, i) => (
										<Card
											className={cn(
												i === 0 &&
													isFiltering &&
													table.state.globalFilter !== '' &&
													'[&>a]:border-ring [&>a]:ring-2',
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
						)
					}
				</ClientTable.Content>
			) : (
				<EmptyState />
			)}

			<ClientTable.PaginationControls />
		</ClientTable.Root>
	);
}

function EmptyState() {
	return (
		<Empty
			className='relative inset-shadow-sm z-10 border border-solid bg-background py-24'
			style={{
				backgroundImage: `
  					linear-gradient(
              120deg,
              var(--color-background) 40%,
              transparent 90%
            ),
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              color-mix(var(--color-gray-3) 50%, transparent) 2px,
              color-mix(var(--color-gray-3) 50%, transparent) 4px
            )`,
				backgroundSize: 'calc(4px * sqrt(2))',
			}}
		>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<UserRectangleIcon />
				</EmptyMedia>
				<EmptyTitle>Your clients will appear here</EmptyTitle>
				<EmptyDescription>Create and find your contacts from this page.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<CreateClientDialog>
					<Button variant='primary'>New client</Button>
				</CreateClientDialog>
			</EmptyContent>
		</Empty>
	);
}
