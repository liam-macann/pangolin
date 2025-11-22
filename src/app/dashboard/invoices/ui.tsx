'use client';

import type { JSX } from 'react';
import type { Data as InvoiceData } from '@/api/invoices/route';
import { useInvoices } from '@/lib/hooks';
import type { ElementType } from '@/lib/utils';

import DataTable from './table';

type Invoice = ElementType<InvoiceData>;

export default function Table({ header, initial }: { header?: JSX.Element; initial?: Invoice[] }) {
	const { data } = useInvoices(initial, { suspense: true });

	return (
		<DataTable.Root data={data}>
			<div className='my-4 mb-6 flex items-center justify-between gap-3 md:mt-8'>
				{header}
				<DataTable.Search className='h-10 grow shadow-none' />
			</div>
			<DataTable.Content />
			<div className='flex items-center justify-end gap-2 py-4'>
				<DataTable.PaginationControls />
			</div>
		</DataTable.Root>
	);
}
