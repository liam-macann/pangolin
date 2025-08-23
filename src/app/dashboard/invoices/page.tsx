import { PlusIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchCustomers, fetchInvoices } from '@/src/app/lib/data';
import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';
import Search from '@/src/app/ui/search';
import { DataTable } from '@/src/components/ui/data-table';
import { Button } from '@/ui/button';
import InvoicesTable, { columns } from '../../ui/invoices/invoice-table';

export const metadata: Metadata = {
	title: 'Invoices',
};

export default async function Page(_props: {
	searchParams?: Promise<{
		query?: string;
		page?: string;
	}>;
}) {
	const customers = await fetchCustomers();

	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className={`font-display text-3xl`}>Invoices</h1>
			</div>
			<div className='my-4 flex items-center justify-between gap-2 md:mt-8'>
				<Search placeholder='Search invoices...' />

				<CreateInvoiceDialog customers={customers}>
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
