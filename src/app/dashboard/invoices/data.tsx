'use client';

import { MagnifyingGlassIcon } from '@phosphor-icons/react';

import { type JSX, useState } from 'react';
import InvoicesTable from '@/src/app/ui/invoices/invoice-table';

import { Input } from '@/ui/input';

export default function Data({ header }: { header?: JSX.Element }) {
	const [filter, setFilter] = useState('');

	return (
		<>
			<div className='my-4 mb-8 flex items-center justify-between gap-2 md:mt-8'>
				<Input
					className='grow'
					aria-label='Search'
					placeholder='Search invoices…'
					onChange={e => setFilter(e.target.value)}
					value={filter}
					prefix={<MagnifyingGlassIcon />}
				/>

				{header}
			</div>

			<InvoicesTable filter={filter} />
		</>
	);
}
