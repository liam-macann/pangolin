'use client';

import {
	ArchiveIcon,
	BuildingOfficeIcon,
	DotsThreeVerticalIcon,
	PencilIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

import { useClient, useClientInvoices, useConfig } from '@/lib/hooks';
import { pluralize } from '@/lib/utils';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

import { InvoiceTableContent, LocaleContext, useInvoiceTable } from './../../invoices/table';
import { UpdateClientDialog } from './../ui/dialogs';
import { OverflowMenu } from './../ui/menu';

const LIMIT = 5;
export function Table({ clientId }: { clientId: string }) {
	const {
		data: { data: client },
	} = useClient(clientId);
	const {
		data: { data: invoices },
	} = useClientInvoices(clientId);
	const {
		data: { data: config },
	} = useConfig();

	const table = useInvoiceTable(
		{
			initialState: { pagination: { pageSize: LIMIT } },
			data: invoices.slice(0, LIMIT),
		},
		() => null,
	);

	return (
		<>
			<LocaleContext value={config.locale}>
				<table.AppTable>
					<InvoiceTableContent table={table} />
				</table.AppTable>
			</LocaleContext>

			{client.invoiceCount > Math.min(invoices.length, LIMIT) && (
				<Link
					href={`/invoices?client=${clientId}`}
					className='mt-3 ml-4 inline-block rounded-md font-medium text-muted-foreground text-sm'
				>
					+ {client.invoiceCount - Math.min(invoices.length, LIMIT)} more{' '}
					{pluralize(client.invoiceCount - Math.min(invoices.length, LIMIT), 'invoice', 'invoices')}
				</Link>
			)}
		</>
	);
}

export function Header({ clientId }: { clientId: string }) {
	const {
		data: { data: client },
	} = useClient(clientId);

	return (
		<div className='flex items-baseline justify-between'>
			<div className='mt-4 space-x-4'>
				<h1 className='inline-flex items-baseline gap-2.5 font-display text-3xl'>
					{client.data.name || (
						<>
							<BuildingOfficeIcon className='relative top-[0.125em] -my-1 shrink-0' />
							{client.data.organization}
						</>
					)}
				</h1>

				{client.isDeleted && (
					<Badge className='-translate-0.5'>
						<ArchiveIcon /> Archived
					</Badge>
				)}

				{client.data.organization && client.data.name && (
					<p className='row-start-1 mt-1.5 flex items-center gap-1 text-muted-foreground'>
						<BuildingOfficeIcon />
						<span>{client.data.organization}</span>
					</p>
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
				<UpdateClientDialog defaultValues={client}>
					<Button variant='outline' aria-label='Edit details' disabled={!!client.isDeleted}>
						<PencilIcon />
						<span className='hidden sm:block'>Edit details</span>
					</Button>
				</UpdateClientDialog>
			</div>
		</div>
	);
}
