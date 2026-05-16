'use client';

import { ArchiveIcon, DotsThreeVerticalIcon, PencilIcon } from '@phosphor-icons/react/dist/ssr';

import { type Data as ClientData } from '@/api/clients/[id]/route';
import { type Data as InvoiceData } from '@/api/invoices/route';
import { useClient, useClientInvoices } from '@/lib/hooks';
import { pluralize } from '@/lib/utils';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

import { columns, createInvoiceTable } from './../../invoices/table';
import { UpdateClientDialog } from './../ui/dialogs';
import { OverflowMenu } from './../ui/menu';

const DataTable = createInvoiceTable(columns.filter(column => column.id !== 'name'));

export function Table({
	initialClient,
	initialInvoices,
	...props
}: {
	initialClient: ClientData;
	initialInvoices: InvoiceData;
	locale: string;
}) {
	const { data: client } = useClient(initialClient.id, initialClient, { suspense: true });
	const { data: invoices } = useClientInvoices(initialClient.id, initialInvoices, {
		suspense: true,
	});

	const limit = 5;

	return (
		<>
			<DataTable.Root pagination={false} data={invoices.slice(0, limit)} {...props}>
				<DataTable.Content />
			</DataTable.Root>

			{client.invoiceCount > Math.min(invoices.length, limit) && (
				<div className='mt-3 ml-4 rounded-md font-medium text-muted-foreground text-sm'>
					+ {client.invoiceCount - Math.min(invoices.length, limit)} more{' '}
					{pluralize(client.invoiceCount - Math.min(invoices.length, limit), 'invoice', 'invoices')}
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

				<div className='flex gap-2'>
					<OverflowMenu
						align='end'
						client={client}
						render={
							<Button variant='ghost' size='icon'>
								<DotsThreeVerticalIcon />
							</Button>
						}
					/>
					<UpdateClientDialog defaultValues={{ ...client.data, clientId: client.id }}>
						<Button variant='outline' aria-label='Edit details' disabled={!!client.isDeleted}>
							<PencilIcon />
							<span className='hidden sm:block'>Edit details</span>
						</Button>
					</UpdateClientDialog>
				</div>
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
