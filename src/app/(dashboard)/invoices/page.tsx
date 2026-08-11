import { type Metadata } from 'next';

import { fetchConfig } from '@/lib/data';
import { fetchInvoices } from '@/lib/data/invoice';

import { Table } from './ui';

export const metadata: Metadata = {
	title: 'Invoices',
};

// instant = false: fully request-time invoice table
export const instant = false;

export default async function Page(_props: {
	searchParams?: Promise<{
		query?: string;
		page?: string;
	}>;
}) {
	const [invoices, config] = await Promise.all([fetchInvoices(), fetchConfig()]);

	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className='font-display text-3xl'>Invoices</h1>
			</div>
			<Table initial={invoices} initialConfig={config} />
		</div>
	);
}
