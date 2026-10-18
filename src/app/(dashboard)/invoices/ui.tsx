'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { PlusCircleIcon, ReceiptIcon } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { type ComponentProps, Suspense, useDeferredValue, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { z } from 'zod';

import { useConfig, useInvoices } from '@/lib/hooks';
import { useFetchAhead, useFetchWhile } from '@/lib/hooks/data/helpers';

import { Button } from '@/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/ui/empty';
import { createDialogHandle } from '@/ui/responsive-dialog';

import { CreateInvoiceDialog } from '@/src/app/(dashboard)/invoices/create-dialog';

import { parseTableParams, tableParams } from './params';
import {
	DEFAULT_SORT,
	InvoiceTableContent,
	PlaceholderTable,
	toAPISort,
	type UseInvoiceTableOptions,
	useInvoiceTable,
} from './table';

export function Table() {
	const searchParams = useSearchParams();

	// Params are used to set initial state, not as controlled table state.
	// Allowing TanStack to control state internally greatly improves performance, compared to reading URL.
	const params = parseTableParams(searchParams);

	/** Our model of the table internal state */
	const internalState = useRef(searchParams.toString());

	const [resetCount, setResetCount] = useState(0);

	// Detects drift between pushed params (our model of internal state) and actual params.
	// This can happen if a navigation occurs, such as clearing search params when clicking the nav.
	if (searchParams.toString() !== internalState.current) {
		setResetCount(k => k + 1);
		// Capture the URL to prevent an infinite loop
		internalState.current = searchParams.toString();
	}

	function updateParams(updates: Partial<z.input<typeof tableParams>>) {
		const params = new URLSearchParams(internalState.current);

		Object.entries(updates).forEach(([key, value]) => {
			if (value) params.set(key, value);
			else params.delete(key);
		});

		const query = params.toString();
		window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);

		// Capture the resulting URL immediately so we can recognize our own writes
		internalState.current = query;
	}

	return (
		<InvoiceTable
			key={resetCount}
			initialState={{
				sorting: params.sort,
				pagination: { pageIndex: params.page ?? 0 },
				globalFilter: params.q,
				...(params.client && { columnFilters: [{ id: 'clientId', value: params.client }] }),
			}}
			onGlobalFilterChange={q => updateParams({ q, client: undefined })}
			onSortingChange={next => updateParams({ sort: z.encode(tableParams.shape.sort, next) })}
			onPaginationChange={({ pageIndex }) =>
				updateParams({ page: z.encode(tableParams.shape.page, pageIndex) })
			}
		/>
	);
}

function InvoiceTable({
	initialState,
	onGlobalFilterChange,
	onSortingChange,
	...options
}: Omit<UseInvoiceTableOptions, 'data'>) {
	const [sorting, setSorting] = useState(initialState?.sorting ?? DEFAULT_SORT);
	const [columnFilters, setColumnFilters] = useState(initialState?.columnFilters ?? []);

	// The table allows you to filter by client UUID, although not exposed in the table UI
	const clientFilter = columnFilters.find(filter => filter.id === 'clientId');
	const clientId = clientFilter ? String(clientFilter.value) : undefined;

	// Keeps showing the previous rows while the new sort or client loads, rather than suspending
	const deferredSorting = useDeferredValue(sorting);
	const deferredClientId = useDeferredValue(clientId);
	const query = useInvoices({
		params: { sort: toAPISort(deferredSorting), client: deferredClientId },
	});

	const table = useInvoiceTable(
		{
			data: query.data,
			pageCount: query.hasNextPage ? -1 : undefined,
			initialState: { ...initialState, sorting },
			onColumnFiltersChange: setColumnFilters,
			// The client filter shows as the search value, so typing replaces it
			onGlobalFilterChange: next => {
				table.setColumnFilters(filters => filters.filter(filter => filter.id !== 'clientId'));
				onGlobalFilterChange?.(next);
			},
			onSortingChange: next => {
				setSorting(next);
				onSortingChange?.(next);
			},
			...options,
		},
		state => ({
			globalFilter: state.globalFilter,
			pagination: state.pagination,
		}),
	);

	const { pageIndex, pageSize } = table.state.pagination;

	// Load a page ahead of what you are viewing
	useFetchAhead(query, query.data.length, table.state.pagination);
	// Keep loading new pages while filtering, until matches fill a page
	useFetchWhile(query, (pageIndex + 1) * pageSize > table.getPrePaginatedRowModel().rows.length);

	/** Uses controlled data length to determine empty state, not filtered table view.
	 * @remarks A client with no invoices still shows the table, so its filter can be cleared. */
	const isEmpty = query.data.length === 0 && !deferredClientId;

	// Search input updates immediately, not through the deferred ID
	const clientName = clientId
		? (table.getCoreRowModel().rows.find(row => row.original.clientData.clientId === clientId)
				?.original.clientData.name ?? clientId)
		: null;

	const isLoading = sorting !== deferredSorting || clientId !== deferredClientId;

	return (
		<table.AppTable>
			<div className='my-4 mb-6 flex items-center justify-between gap-3 md:mt-8'>
				<Dialog />
				<table.Search
					className='h-10 grow shadow-none'
					value={clientName ?? undefined}
					placeholder='Search invoices…'
				/>
			</div>

			{!isEmpty ? (
				<>
					<InvoiceTableContent table={table} loading={isLoading} />
					<div className='flex items-center justify-end gap-2 py-4'>
						<table.PaginationControls />
					</div>
				</>
			) : (
				<EmptyState />
			)}
		</table.AppTable>
	);
}

const createDialog = createDialogHandle();

function EmptyState() {
	const { data: config } = useConfig();

	return (
		<>
			<div className='scrim-b-24 scrim-background max-h-44 overflow-clip'>
				<PlaceholderTable config={config} />
			</div>

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
						<ReceiptIcon />
					</EmptyMedia>
					<EmptyTitle>Your invoices will appear here</EmptyTitle>
					<EmptyDescription>Create, view, and filter all invoices from this page.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant='primary' render={<DialogPrimitive.Trigger handle={createDialog} />}>
						Create invoice
					</Button>
				</EmptyContent>
			</Empty>
		</>
	);
}

function Trigger(props: ComponentProps<typeof Button>) {
	return (
		<Button variant='outline' size='lg' {...props}>
			<PlusCircleIcon />
			<span className='hidden sm:block'>Create invoice</span>
		</Button>
	);
}

function DialogContent() {
	const { data: config } = useConfig();

	return (
		<CreateInvoiceDialog handle={createDialog} config={config}>
			<Trigger />
		</CreateInvoiceDialog>
	);
}

export function Dialog() {
	return (
		<ErrorBoundary fallback={<Trigger disabled />}>
			<Suspense fallback={<Trigger className='cursor-progress' />}>
				<DialogContent />
			</Suspense>
		</ErrorBoundary>
	);
}
