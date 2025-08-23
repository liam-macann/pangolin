import type { ColumnDef } from '@tanstack/react-table';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchCustomers } from '@/src/app/lib/data';
import { DataTable } from '@/src/components/ui/data-table';
import type { customers } from '@/src/db/schema';

export const metadata: Metadata = {
	title: 'Customers',
};

export default async function Page() {
	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className='mb-6 font-display text-3xl'>Customers</h1>
			</div>

			<Suspense fallback={<DataTable columns={columns} data={[]} />}>
				<Table />
			</Suspense>
		</div>
	);
}

async function Table() {
	const customers = await fetchCustomers();
	return <DataTable columns={columns} data={customers} />;
}

const columns: ColumnDef<typeof customers.$inferSelect>[] = [
	{
		accessorKey: 'name',
		header: 'Name',
	},
	{
		accessorKey: 'email',
		header: 'Email',
	},
];
