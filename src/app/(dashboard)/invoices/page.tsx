import { type Metadata } from 'next';

import { configQueries } from '@/lib/hooks/data/config';
import { PrefetchQuery } from '@/lib/hooks/data/helpers/prefetch';
import { invoiceQueries } from '@/lib/hooks/data/invoice';

import { parseTableParams } from './params';
import { DEFAULT_SORT, toAPISort } from './table/sort';
import { Table } from './ui';

export const metadata: Metadata = { title: 'Invoices' };

// instant = false: fully request-time invoice table
export const instant = false;

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { sort, client } = parseTableParams(await searchParams);
	const invoices = invoiceQueries.list({ sort: toAPISort(sort ?? DEFAULT_SORT), client });

	return (
		<PrefetchQuery queries={[invoices, configQueries.current()]}>
			<div className='w-full'>
				<div className='flex w-full items-center justify-between'>
					<h1 className='font-display text-3xl'>Invoices</h1>
				</div>
				<Table />
			</div>
		</PrefetchQuery>
	);
}
