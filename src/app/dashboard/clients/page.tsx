import type { ColumnDef } from '@tanstack/react-table';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchClient } from '@/src/app/lib/data';
import { DataTable } from '@/src/components/ui/data-table';
import type { clients } from '@/src/db/schema';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page() {
	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className='mb-6 font-display text-3xl'>Clients</h1>
			</div>

			<Suspense fallback={<DataTable columns={columns} data={[]} />}>
				<Table />
			</Suspense>
		</div>
	);
}

async function Table() {
	const clients = await fetchClient();
	return <DataTable columns={columns} data={clients} />;
}

const columns: ColumnDef<typeof clients.$inferSelect>[] = [
	{
		accessorKey: 'name',
		header: 'Name',
	},
	{
		accessorKey: 'email',
		header: 'Email',
	},
];
