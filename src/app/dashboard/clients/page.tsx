import type { Metadata } from 'next';

import { Table } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page() {
	return (
		<div className='w-full'>
			<div className='flex w-full items-center justify-between'>
				<h1 className='mb-6 font-display text-3xl'>Clients</h1>
			</div>

			<Table />
		</div>
	);
}
