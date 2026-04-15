import { UserCirclePlusIcon } from '@phosphor-icons/react/ssr';
import { type Metadata } from 'next';
import { Suspense } from 'react';

import { fetchClients } from '@/lib/data/client';

import { Button } from '@/ui/button';

import { CreateClientDialog } from './create';
import { Clients } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page() {
	const clients = await fetchClients();

	return (
		<div className='w-full'>
			<div className='mb-8 flex w-full items-baseline justify-between'>
				<h1 className='font-display text-3xl'>Clients</h1>
				<Suspense fallback={<DialogTrigger />}>
					<Dialog />
				</Suspense>
			</div>

			<Clients initial={clients} />
		</div>
	);
}

function Dialog() {
	return (
		<CreateClientDialog>
			<DialogTrigger />
		</CreateClientDialog>
	);
}

function DialogTrigger() {
	return (
		<Button variant='outline'>
			<UserCirclePlusIcon />
			<span className='hidden sm:block'>New client</span>
		</Button>
	);
}
