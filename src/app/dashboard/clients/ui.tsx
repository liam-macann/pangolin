'use client';
import type { ColumnDef } from '@tanstack/react-table';
import type { clients } from '@/db/schema';
import { useClients } from '@/lib/hooks';
import { DataTable } from '@/ui/data-table';

export function Table() {
	const { data, isLoading, isError } = useClients();

	if (isError) throw new Error('Failed to fetch clients');

	return isLoading ? (
		<DataTable columns={columns} data={[]} />
	) : (
		data && <DataTable columns={columns} data={data} />
	);
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
