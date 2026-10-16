'use client';

import { UserCirclePlusIcon } from '@phosphor-icons/react';
import { UserRectangleIcon } from '@phosphor-icons/react/dist/ssr';
import { type PaginationState, type TableState } from '@tanstack/react-table';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Client } from '@/api/dto/client';
import { useClients } from '@/lib/hooks';
import { useFetchAhead, useFetchWhile } from '@/lib/hooks/data/helpers';
import { cn } from '@/lib/utils';

import {
	createDataTableColumnHelper,
	type DataTableFeatures,
	useDataTable,
	useDeferredPage,
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

			<Favorites />

			<MaintainHeight>
				<Table />
			</MaintainHeight>
		</div>
	);
}

function useFavorites() {
	const selectFavorites = (clients: Client[]) => clients.filter(client => client.isFavorite);

	const { data: global } = useClients({ select: selectFavorites });
	const optimisticIds = new Set(global.map(client => client.id));

	// Pulls favorited clients directly from the API, so deeply indexed clients are included.
	const { data: targeted } = useClients({ params: { favorite: true }, select: selectFavorites });

	// The global cache holds every client up to its last loaded page, in API order.
	// Favorites missing from it necessarily rank afterwards.
	return [...global, ...targeted.filter(c => !optimisticIds.has(c.id))].slice(0, 32);
}

export function Favorites() {
	const favorites = useFavorites();
	if (favorites.length === 0) return null;

	return (
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

function Table() {
	const { data, ...query } = useClients();

	const router = useRouter();

	const [isFiltering, setIsFiltering] = useState(false);
	const table = useDataTable(
		{
			data,
			columns,
			pageCount: query.hasNextPage ? -1 : undefined,
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
		state => ({ globalFilter: state.globalFilter, pagination: state.pagination }),
	);

	const { pageIndex, pageSize } = table.state.pagination;

	// Load a page ahead of what you are viewing
	useFetchAhead(query, data.length, table.state.pagination);
	// Search only filters loaded clients, so keep loading until matches fill a page
	useFetchWhile(query, (pageIndex + 1) * pageSize > table.getPrePaginatedRowModel().rows.length);

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
					{(_, { globalFilter, pagination }) => (
						<ClientCards
							pagination={pagination}
							highlightFirst={isFiltering && globalFilter !== ''}
						/>
					)}
				</table.Content>
			) : (
				<EmptyState />
			)}

			<table.PaginationControls />
		</table.AppTable>
	);
}

function ClientCards({
	pagination,
	highlightFirst,
}: {
	pagination: PaginationState;
	highlightFirst: boolean;
}) {
	const { rows, busy } = useDeferredPage<Client>(pagination);

	if (!rows.length) return <div className='py-6 text-center text-muted-foreground'>No results</div>;

	return (
		<section
			aria-busy={busy}
			className={cn(
				'grid gap-4 transition-opacity duration-200 ease-in-out-circ sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
				busy && 'cursor-wait opacity-50 delay-150 duration-500',
			)}
		>
			<AnimatePresence mode='popLayout' initial={false}>
				{rows.map((client, i) => (
					<Card
						className={cn(i === 0 && highlightFirst && '[&>a]:border-ring [&>a]:ring-2')}
						style={{ zIndex: rows.length - i }}
						key={client.original.id}
						client={client.original}
					/>
				))}
			</AnimatePresence>
		</section>
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
