import { type Metadata } from 'next';

import { fetchClients } from '@/lib/data/client';

import { Clients } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page() {
	const clients = await fetchClients();
	return <Clients initial={clients} />;
}
