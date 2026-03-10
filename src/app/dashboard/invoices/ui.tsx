'use client';

import type { JSX } from 'react';
import type { Data as InvoiceData } from '@/api/invoices/route';
import { useInvoices } from '@/lib/hooks';
import type { ElementType } from '@/lib/utils';

import InvoiceTable from './table';

type Invoice = ElementType<InvoiceData>;

export default function Table({
	header,
	initial,
	locale,
}: {
	header?: JSX.Element;
	initial?: Invoice[];
	locale: string;
}) {
	const { data } = useInvoices(initial, { suspense: true });

	return (
		<InvoiceTable.Root data={data} locale={locale}>
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
