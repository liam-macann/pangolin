'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { PlusCircleIcon, ReceiptIcon } from '@phosphor-icons/react';
import { type PaginationState } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import {
	type ComponentProps,
	type ReactNode,
	Suspense,
	startTransition,
	useDeferredValue,
	useRef,
	useState,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { z } from 'zod';

import { type Invoice } from '@/api/dto/invoice';
import { useConfig, useInvoices } from '@/lib/hooks';
import { useFetchWhile } from '@/lib/hooks/data/helpers';
import { cn } from '@/lib/utils';

import { useDataTableContext, useDeferredPage } from '@/components/data-table';
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

/** Rows shown at first, and added by each "Get more". */
const PAGE_SIZE = 20;
/** Preview of rows on the next page, faded beneath the "Show more" button as a hint. */
const PREVIEW_SIZE = 2;

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
				// Rows grow from the top, so the table only ever shows its first page
				pagination: {
					pageIndex: 0,
					pageSize: ((params.page ?? 0) + 1) * PAGE_SIZE,
				},
				globalFilter: params.q,
				...(params.client && { columnFilters: [{ id: 'clientId', value: params.client }] }),
			}}
			onGlobalFilterChange={q => updateParams({ q, client: undefined })}
			onSortingChange={next => updateParams({ sort: z.encode(tableParams.shape.sort, next) })}
			onPaginationChange={({ pageSize }) =>
				updateParams({
					page: z.encode(tableParams.shape.page, pageSize / PAGE_SIZE - 1),
				})
			}
		/>
	);
}

function InvoiceTable({
	initialState,
	onGlobalFilterChange,
	onSortingChange,
	onColumnFiltersChange,
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
			// A new sort or filter starts over from one page of rows
			onColumnFiltersChange: next => {
				table.setPageSize(PAGE_SIZE);
				setColumnFilters(next);
				onColumnFiltersChange?.(next);
			},
			// The client filter shows as the search value, so typing replaces it
			onGlobalFilterChange: next => {
				table.setPageSize(PAGE_SIZE);
				table.setColumnFilters(filters => filters.filter(filter => filter.id !== 'clientId'));
				onGlobalFilterChange?.(next);
			},
			onSortingChange: next => {
				table.setPageSize(PAGE_SIZE);
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

	const { pageSize } = table.state.pagination;
	const matchCount = table.getPrePaginatedRowModel().rows.length;

	// Load a page ahead of what is shown, so "Show more" is usually instant and has a preview
	useFetchWhile(query, pageSize + PAGE_SIZE + PREVIEW_SIZE > query.data.length);
	// Keep loading new pages while filtering, until matches fill what is shown
	useFetchWhile(query, pageSize > matchCount);

	/** Uses controlled data length to determine empty state, not filtered table view.
	 * @remarks A client with no invoices still shows the table, so its filter can be cleared. */
	const isEmpty = query.data.length === 0 && !deferredClientId;

	// Search input updates immediately, not through the deferred ID
	const clientName = clientId
		? (table.getCoreRowModel().rows.find(row => row.original.client.id === clientId)?.original
				.client.name ?? clientId)
		: null;

	const isLoading = sorting !== deferredSorting || clientId !== deferredClientId;

	const canGetMore = table.getCanNextPage();

	return (
		<table.AppTable>
			<div className='my-4 flex items-center justify-between gap-3 md:mt-8 md:mb-6'>
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
					{canGetMore && (
						<InvoicePreview pagination={table.state.pagination}>
							<Button
								className='shadow-sm'
								variant='outline'
								size='lg'
								loading={pageSize > matchCount && query.isFetchingNextPage}
								// Renders the added rows once, rather than an urgent pass of the old rows and a deferred pass
								onClick={() => startTransition(() => table.setPageSize(size => size + PAGE_SIZE))}
							>
								Show more
							</Button>
						</InvoicePreview>
					)}
				</>
			) : (
				<EmptyState />
			)}
		</table.AppTable>
	);
}

/** The previewed rows on the next page, with child content positioned above. */
function InvoicePreview({
	pagination,
	children,
	className,
}: {
	pagination: PaginationState;
	children: ReactNode;
	className?: string;
}) {
	// Currently rendered rows (deferred state update)
	const { rows } = useDeferredPage<Invoice>(pagination);

	const table = useDataTableContext<Invoice>();
	const data = table
		.getPrePaginatedRowModel()
		.rows.slice(rows.length, rows.length + PREVIEW_SIZE)
		.map(row => row.original);

	const preview = useInvoiceTable({ data }, () => null);

	return (
		// Continues the row borders, which the table above drops from its last row, outside the fade
		<div className={cn('relative', className, data.length > 0 && 'border-t border-dotted')}>
			{data.length > 0 && (
				<div inert className='scrim-b-full scrim-background pointer-events-none select-none'>
					<preview.AppTable>
						<InvoiceTableContent
							table={preview}
							className='max-h-32 [&_thead]:hidden'
							getRowAttr={(_, i) => ({ style: { opacity: (0.4 / (i + 1)).toFixed(2) } })}
						/>
					</preview.AppTable>
				</div>
			)}

			<div
				className={cn(
					'flex justify-center',
					data.length > 0 ? 'absolute inset-0 items-center' : 'py-4',
				)}
			>
				{children}
			</div>
		</div>
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
              color-mix(var(--color-border) 20%, transparent) 2px,
              color-mix(var(--color-border) 20%, transparent) 4px
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
			<span>
				Create <span className='hidden sm:inline'>invoice</span>
			</span>
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
