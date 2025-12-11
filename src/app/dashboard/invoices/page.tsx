import { PlusCircleIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { fetchInvoices, getUserConfig } from '@/lib/data';
import { CreateInvoiceDialog } from '@/src/app/ui/invoices/create-form';
import { Button } from '@/ui/button';
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
	const [invoices, config] = await Promise.all([
		fetchInvoices(),
		getUserConfig().catch(() => redirect('/onboarding')),
	]);

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
						<Dialog />
					</Suspense>
				}
			/>
		</div>
	);
}

async function Dialog() {
	const config = await getUserConfig().catch(() => redirect('/onboarding'));

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
