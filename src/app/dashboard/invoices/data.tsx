'use client';

import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { type JSX, useState } from 'react';
import type { Data as InvoiceData } from '@/api/invoices/route';
import type { ElementType } from '@/lib/utils';
import InvoicesTable from '@/src/app/ui/invoices/invoice-table';
import { Input } from '@/ui/input';

type Invoice = ElementType<InvoiceData>;

export default function Data({ header, initial }: { header?: JSX.Element; initial?: Invoice[] }) {
	const [filter, setFilter] = useState('');

	return (
		<>
			<div className='my-4 mb-8 flex items-center justify-between gap-3 md:mt-8'>
				{header}

				<Input
					className='h-10 grow shadow-none'
					aria-label='Search'
					placeholder='Search invoices…'
					onChange={e => setFilter(e.target.value)}
					value={filter}
					prefix={<MagnifyingGlassIcon />}
				/>
			</div>

			<InvoicesTable initial={initial} filter={filter} />
		</>
	);
}
