'use client';

import { type SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { type JSX, useRef, useState } from 'react';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { useInvoices } from '@/lib/hooks';
import { type ElementType } from '@/lib/utils';

import InvoiceTable, { DEFAULT_SORT } from './table';

type Invoice = ElementType<InvoiceData>;

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

export default function Table({
	header,
	initial,
	locale,
}: {
	header?: JSX.Element;
	initial?: Invoice[];
	locale: string;
}) {
	const searchParams = useSearchParams();
	const { data } = useInvoices(initial, { suspense: true });

	// Params are used to set initial state, not as controlled table state.
	// Allowing Tanstack to control state internally greatly improves performance, compared to reading URL.
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

		// Capture the resulting URL immediately so we can recognise our own writes
		internalState.current = query;
	}

	return (
		<InvoiceTable.Root
			key={resetCount}
			data={data}
			locale={locale}
			initialState={{
				sorting: parseSortParam(searchParams.get('sort')),
				pagination: { pageIndex: pageParam > 1 ? pageParam - 1 : 0 },
				globalFilter: searchParams.get('q'),
				...(clientParam && { columnFilters: [{ id: 'clientId', value: clientParam }] }),
			}}
			onGlobalFilterChange={q => updateParams({ q, client: null })}
			onSortingChange={next => updateParams({ sort: serializeSortParam(next) })}
			onPageIndexChange={index => updateParams({ page: index === 0 ? null : String(index + 1) })}
		>
			<div className='my-4 mb-6 flex items-center justify-between gap-3 md:mt-8'>
				{/** biome-ignore lint/complexity/noUselessFragments: Necessary for React to see one child to prevent need for keys */}
				<>{header}</>
				<InvoiceTable.Search className='h-10 grow shadow-none' />
			</div>
			<InvoiceTable.Content />
			<div className='flex items-center justify-end gap-2 py-4'>
				<InvoiceTable.PaginationControls />
			</div>
		</InvoiceTable.Root>
	);
}
