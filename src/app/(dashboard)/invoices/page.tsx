import { type Metadata } from 'next';

import { configQueries } from '@/lib/hooks/data/config';
import { PrefetchQuery } from '@/lib/hooks/data/helpers/prefetch';
import { invoiceQueries } from '@/lib/hooks/data/invoice';

import { Table } from './ui';

export const metadata: Metadata = {
	title: 'Invoices',
};

// instant = false: fully request-time invoice table
export const instant = false;

export default async function Page(_props: {
	searchParams?: Promise<{ query?: string; page?: string }>;
}) {
	return (
		<PrefetchQuery queries={[invoiceQueries.list(), configQueries.current()]}>
			<div className='w-full'>
				<div className='flex w-full items-center justify-between'>
					<h1 className='font-display text-3xl'>Invoices</h1>
				</div>
				<Table />
			</div>
		</PrefetchQuery>
	);
}
