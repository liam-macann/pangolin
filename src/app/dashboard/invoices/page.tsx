import { PlusIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchClient, getUserConfig } from '@/lib/data';
import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';
import { Button } from '@/ui/button';
import Data from './data';

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
			<Data
				header={
					<Suspense fallback={<DialogTrigger />}>
						<Dialog />
					</Suspense>
				}
			/>
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
