'use client';

import { UserCirclePlusIcon } from '@phosphor-icons/react';
import { UserRectangleIcon } from '@phosphor-icons/react/dist/ssr';
import { type TableState } from '@tanstack/react-table';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Client } from '@/api/dto/client';
import { useClients } from '@/lib/hooks';
import { cn } from '@/lib/utils';

import {
	createDataTableColumnHelper,
	type DataTableFeatures,
	useDataTable,
} from '@/components/data-table';
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

export function Clients() {
	const { data } = useClients();
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

const columnHelper = createDataTableColumnHelper<Client>();
const columns = columnHelper.columns([
	columnHelper.accessor('isFavorite', {
		id: 'isFavorite',
		filterFn: 'equals',
	}),
	columnHelper.accessor('data.name', {
		header: 'Name',
	}),
	columnHelper.accessor('data.organization', {
		header: 'Organisation',
	}),
	columnHelper.accessor('data.email', {
		header: 'Email',
	}),
	columnHelper.accessor('invoiceCount', {
		header: 'Invoices',
	}),
]);

function Table({ data }: { data: Client[] }) {
	const router = useRouter();

	const [isFiltering, setIsFiltering] = useState(false);
	const table = useDataTable(
		{
			data,
			columns,
			initialState: {
				pagination: { pageSize: 40 },
				columnFilters: [{ id: 'isFavorite', value: false }],
			},
			// Favorites have their own section, so they only appear in the list while searching
			onGlobalFilterChange: val => {
				if (val === '') table.resetColumnFilters();
				else table.setColumnFilters([]);
			},
		},
		() => null,
	);

	return (
		<table.AppTable>
			<table.Search
				className='mb-6 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onKeyDown={e => {
					if (e.key === 'Enter' && e.currentTarget.value !== '') {
						const id = table.getRowModel().rows[0]?.original?.id;
						if (id) router.push(`/clients/${id}`);
					}
				}}
				onFocus={() => setIsFiltering(true)}
				onBlur={() => setIsFiltering(false)}
			/>

			{data.length > 0 ? (
				<table.Content
					selector={(state: TableState<DataTableFeatures>) => ({
						columnFilters: state.columnFilters,
						globalFilter: state.globalFilter,
						pagination: state.pagination,
						sorting: state.sorting,
					})}
				>
					{(table, { globalFilter }) =>
						table.getRowModel().rows.length ? (
							<section className='grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
								<AnimatePresence mode='popLayout' initial={false}>
									{table.getRowModel().rows.map((client, i) => (
										<Card
											className={cn(
												i === 0 &&
													isFiltering &&
													globalFilter !== '' &&
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
				</table.Content>
			) : (
				<EmptyState />
			)}

			<table.PaginationControls />
		</table.AppTable>
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
