'use client';
import type { ColumnDef } from '@tanstack/react-table';
import type { Data as ClientData } from '@/api/clients/route';
import type { clients } from '@/db/schema';
import { useClients } from '@/lib/hooks';
import type { ElementType } from '@/lib/utils';
import { DataTable } from '@/ui/data-table';

type Client = ElementType<ClientData>;

export function Table({ initial }: { initial?: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	return <DataTable columns={columns} data={data} />;
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
