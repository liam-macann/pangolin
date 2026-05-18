'use client';

import { type SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { type JSX } from 'react';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { useInvoices } from '@/lib/hooks';
import { type ElementType } from '@/lib/utils';

import InvoiceTable, { DEFAULT_SORT } from './table';

type Invoice = ElementType<InvoiceData>;

function parseSortParam(sort: string | null): SortingState | undefined {
	if (!sort) return;
	const parts = sort.split(':');
	if (parts.length !== 2 || !parts[0]) return;
	return [{ id: parts[0], desc: parts[1] === 'desc' }];
}

function serializeSortParam(sorting: SortingState): string | null {
	if (sorting.length === 0) return null;
	const col = sorting[0];
	if (col.id === DEFAULT_SORT[0].id && col.desc === DEFAULT_SORT[0].desc) return null;
	return `${col.id}:${col.desc ? 'desc' : 'asc'}`;
}

/** Pushes the updated query parameters
 *
 * @remarks Bypasses Next.js to prevent rerenders
 */
function updateParams(updates: Record<string, string | null>) {
	const params = new URLSearchParams(window.location.search);

	Object.entries(updates).forEach(([key, value]) => {
		if (value === null || value === '') params.delete(key);
		else params.set(key, value);
	});

	const query = params.toString();
	window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
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

	const pageParam = Number(searchParams.get('page'));

	return (
		<InvoiceTable.Root
			data={data}
			locale={locale}
			// Read search params
			initialState={{
				sorting: parseSortParam(searchParams.get('sort')),
				pagination: { pageIndex: pageParam > 1 ? pageParam - 1 : 0 },
				globalFilter: searchParams.get('q'),
			}}
			// Serialize state in search params
			onGlobalFilterChange={q => updateParams({ q })}
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
