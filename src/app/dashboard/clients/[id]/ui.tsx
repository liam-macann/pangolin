'use client';

import { type Data } from '@/api/invoices/route';

import { columns, createInvoiceTable, statusVariants } from './../../invoices/table';

const DataTable = createInvoiceTable(
	columns
		.filter(column => column.id !== 'name')
		.map(v => {
			const column = { ...v };

			// Prevent mutation — route data is not fed from SWR hook, so will not refresh
			if (column.id === 'status') {
				column.cell = ({ row }) => (
					<span className={statusVariants({ variant: row.original.status })}>
						{row.getValue('status')}
					</span>
				);
			}

			return { ...column, enableSorting: false };
		}),
);

export function Table(props: { data: Data; locale: string }) {
	return (
		<DataTable.Root pagination={false} {...props}>
			<DataTable.Content />
		</DataTable.Root>
	);
}
