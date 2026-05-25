import { PlusCircleIcon } from '@phosphor-icons/react/ssr';
import { type Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getUserConfig } from '@/lib/data';
import { fetchInvoices } from '@/lib/data/invoice';

import { Button } from '@/ui/button';

import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';

import Data from './ui';

export const metadata: Metadata = {
	title: 'Invoices',
};

export default async function Page(_props: {
	searchParams?: Promise<{
		query?: string;
		page?: string;
	}>;
}) {
	const [invoices, config] = await Promise.all([fetchInvoices(), getUserConfig()]);

	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className='font-display text-3xl'>Invoices</h1>
			</div>
			<Data
				initial={invoices}
				locale={config.locale}
				header={
					<Suspense fallback={<DialogTrigger />}>
						<Dialog config={config} />
					</Suspense>
				}
			/>
		</div>
	);
}

async function Dialog({ config }: { config: Awaited<ReturnType<typeof getUserConfig>> }) {
	return (
		<CreateInvoiceDialog config={config}>
			<DialogTrigger />
		</CreateInvoiceDialog>
	);
}

function DialogTrigger() {
	return (
		<Button variant='outline' size='lg'>
			<PlusCircleIcon />
			<span className='hidden sm:block'>Create invoice</span>
		</Button>
	);
}
