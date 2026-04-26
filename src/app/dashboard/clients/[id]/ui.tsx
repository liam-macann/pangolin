'use client';

import { ArchiveIcon, PencilIcon } from '@phosphor-icons/react/dist/ssr';

import { type Data as ClientData } from '@/api/clients/[id]/route';
import { type Data as InvoiceData } from '@/api/invoices/route';
import { useClient } from '@/lib/hooks';
import { pluralize } from '@/lib/utils';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

import { columns, createInvoiceTable, statusVariants } from './../../invoices/table';
import { UpdateClientDialog } from './../ui/dialogs';

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

export function Table({
	initialClient,
	...props
}: {
	initialClient: ClientData;
	data: InvoiceData;
	locale: string;
}) {
	const { data: client } = useClient(initialClient.id, initialClient, { suspense: true });

	return (
		<>
			<DataTable.Root pagination={false} {...props}>
				<DataTable.Content />
			</DataTable.Root>

			{client.invoiceCount > props.data.length && (
				<div className='mt-3 ml-4 rounded-md font-medium text-muted-foreground text-sm'>
					+ {client.invoiceCount - props.data.length} more{' '}
					{pluralize(client.invoiceCount - props.data.length, 'invoice', 'invoices')}
				</div>
			)}
		</>
	);
}

export function Header({ initialClient }: { initialClient: ClientData }) {
	const { data: client } = useClient(initialClient.id, initialClient, { suspense: true });

	return (
		<>
			<div className='flex items-baseline justify-between'>
				<div className='space-x-4'>
					<h1 className='mt-4 inline-block font-display text-3xl'>{client.data.name}</h1>
					{client.isDeleted && (
						<Badge className='-translate-0.5'>
							<ArchiveIcon /> Archived
						</Badge>
					)}
				</div>

				<UpdateClientDialog defaultValues={{ ...client.data, clientId: client.id }}>
					<Button variant='outline' aria-label='Edit details' disabled={!!client.isDeleted}>
						<PencilIcon />
						<span className='hidden sm:block'>Edit details</span>
					</Button>
				</UpdateClientDialog>
			</div>

			<section className='flex flex-col gap-2 text-muted-foreground text-sms'>
				<p>{client.data.email}</p>

				{client.data.address && (
					<p className='leading-tight'>
						{client.data.formattedAddress?.split('\n').map(line => {
							// Continuous strings of all caps, including numbers
							const regex = /(\b[A-Z][A-Z 0-9]+\b)/g;

							return (
								<span key={line}>
									{line.split(regex).map(word => {
										if (!regex.test(word)) return word;

										return (
											<span key={word} className='small-caps'>
												{word}
											</span>
										);
									})}
									<br />
								</span>
							);
						})}
					</p>
				)}
			</section>
		</>
	);
}
