import { PlusIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchClient, getUserConfig } from '@/lib/data';
import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';
import InvoicesTable from '@/src/app/ui/invoices/invoice-table';
import Search from '@/src/app/ui/search';
import { Button } from '@/ui/button';

export const metadata: Metadata = {
	title: 'Invoices',
};

export default function Page(_props: {
	searchParams?: Promise<{
		query?: string;
		page?: string;
	}>;
}) {
	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className={`font-display text-3xl`}>Invoices</h1>
			</div>
			<div className='my-4 mb-8 flex items-center justify-between gap-2 md:mt-8'>
				<Search className='grow bg-card' placeholder='Search invoices...' />

				<Suspense fallback={<DialogTrigger />}>
					<Dialog />
				</Suspense>
			</div>

			<InvoicesTable />
		</div>
	);
}

async function Dialog() {
	const clients = await fetchClient();
	const config = await getUserConfig();

	return (
		<CreateInvoiceDialog config={config} clients={clients}>
			<DialogTrigger />
		</CreateInvoiceDialog>
	);
}

function DialogTrigger() {
	return (
		<Button variant='primary'>
			<span className='hidden sm:block'>Create Invoice</span>
			<PlusIcon className='h-5' />
		</Button>
	);
}
