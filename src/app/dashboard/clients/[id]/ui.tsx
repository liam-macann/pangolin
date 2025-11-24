'use client';

import type { Data } from '@/api/invoices/route';
import { columns, createInvoiceTable } from '../../invoices/table';

const DataTable = createInvoiceTable(
	columns
		.filter(column => column.id !== 'name')
		.map(column => ({ ...column, enableSorting: false })),
);

export function Table({ data }: { data: Data }) {
	return (
		<DataTable.Root pagination={false} data={data}>
			<DataTable.Content />
			<div className='flex items-center justify-end gap-2 py-4'>
				<DataTable.PaginationControls />
			</div>
		</DataTable.Root>
	);
}
