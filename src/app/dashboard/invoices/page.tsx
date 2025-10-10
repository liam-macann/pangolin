import { PlusIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchClient, fetchInvoices } from '@/lib/data';
import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';
import InvoicesTable, { columns } from '@/src/app/ui/invoices/invoice-table';
import Search from '@/src/app/ui/search';
import { Button } from '@/ui/button';
import { DataTable } from '@/ui/data-table';

export const metadata: Metadata = {
	title: 'Invoices',
};

export default async function Page(_props: {
	searchParams?: Promise<{
		query?: string;
		page?: string;
	}>;
}) {
	const clients = await fetchClient();

	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className={`font-display text-3xl`}>Invoices</h1>
			</div>
			<div className='my-4 flex items-center justify-between gap-2 md:mt-8'>
				<Search placeholder='Search invoices...' />

				<CreateInvoiceDialog clients={clients}>
					<Button>
						<span className='hidden md:block'>Create Invoice</span>
						<PlusIcon className='h-5' />
					</Button>
				</CreateInvoiceDialog>
			</div>
			<Suspense fallback={<DataTable columns={columns} data={[]} />}>
				<Table />
			</Suspense>
		</div>
	);
}

async function Table() {
	const invoices = await fetchInvoices();
	return <InvoicesTable invoices={invoices} />;
}
