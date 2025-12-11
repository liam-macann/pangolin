import { UserCirclePlusIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { fetchClients } from '@/lib/data/client';
import { Button } from '@/ui/button';
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
				<Button variant='outline' disabled>
					<UserCirclePlusIcon />
					<span>New client</span>
				</Button>
			</div>

			<Clients initial={clients} />
		</div>
	);
}
