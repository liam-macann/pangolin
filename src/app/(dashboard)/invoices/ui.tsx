'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { PlusCircleIcon, ReceiptIcon } from '@phosphor-icons/react';
import { type SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { type ComponentProps, Suspense, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { useConfig, useInvoices } from '@/lib/hooks';

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

import {
	DEFAULT_SORT,
	InvoiceTableContent,
	PlaceholderTable,
	type UseInvoiceTableOptions,
	useInvoiceTable,
} from './table';

function parseSortParam(sort: string | null): SortingState | undefined {
	if (!sort) return;
	const parsed = sort.split(',').map(part => {
		// Ensures that we are not matching a colon in the column name
		const sep = part.lastIndexOf(':');
		if (sep === -1 || sep === 0) return null;

		const key = part.slice(0, sep);
		const value = part.slice(sep + 1);

		if (value !== 'asc' && value !== 'desc') return null;
		return { id: key, desc: value === 'desc' };
	});

	const filtered = parsed.filter((p): p is NonNullable<typeof p> => p !== null);

	// If any column in the parse failed, discard sort
	if (parsed.length !== filtered.length) return;

	return filtered;
}

function serializeSortParam(sorting: SortingState): string | null {
	const buildSortString = (sorting: SortingState) =>
		sorting.map(col => `${col.id}:${col.desc ? 'desc' : 'asc'}`).join(',');

	if (sorting.length === 0) return null;
	const serialized = buildSortString(sorting);
	return serialized === buildSortString(DEFAULT_SORT) ? null : serialized;
}

export function Table() {
	const { data: invoices } = useInvoices();

	const searchParams = useSearchParams();

	// Params are used to set initial state, not as controlled table state.
	// Allowing TanStack to control state internally greatly improves performance, compared to reading URL.
	const pageParam = Number(searchParams.get('page'));
	const clientParam = searchParams.get('client');

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

	function updateParams(updates: Record<string, string | null>) {
		const params = new URLSearchParams(internalState.current);

		Object.entries(updates).forEach(([key, value]) => {
			if (value === null || value === '') params.delete(key);
			else params.set(key, value);
		});

		const query = params.toString();
		window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);

		// Capture the resulting URL immediately so we can recognize our own writes
		internalState.current = query;
	}

	return (
		<InvoiceTable
			key={resetCount}
			data={invoices}
			initialState={{
				sorting: parseSortParam(searchParams.get('sort')),
				pagination: { pageIndex: pageParam > 1 ? pageParam - 1 : 0 },
				globalFilter: searchParams.get('q') ?? undefined,
				...(clientParam && { columnFilters: [{ id: 'clientId', value: clientParam }] }),
			}}
			onGlobalFilterChange={q => updateParams({ q, client: null })}
			onSortingChange={next => updateParams({ sort: serializeSortParam(next) })}
			onPaginationChange={({ pageIndex }) =>
				updateParams({ page: pageIndex === 0 ? null : String(pageIndex + 1) })
			}
		/>
	);
}

function InvoiceTable({ data, onGlobalFilterChange, ...options }: UseInvoiceTableOptions) {
	const table = useInvoiceTable(
		{
			data,
			// The client filter shows as the search value, so typing replaces it
			onGlobalFilterChange: next => {
				table.setColumnFilters(filters => filters.filter(filter => filter.id !== 'clientId'));
				onGlobalFilterChange?.(next);
			},
			...options,
		},
		state => ({ columnFilters: state.columnFilters }),
	);

	/** Uses controlled data length to determine empty state, not filtered table view */
	const isEmpty = data.length === 0;

	// The table allows you to filter by client UUID, although not exposed in the table UI
	const clientFilter = table.state.columnFilters.find(filter => filter.id === 'clientId');
	const clientId = clientFilter ? String(clientFilter.value) : null;
	const clientName = clientId
		? (table.getCoreRowModel().rows.find(row => row.original.clientData.clientId === clientId)
				?.original.clientData.name ?? clientId)
		: null;

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
					<InvoiceTableContent table={table} />
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
