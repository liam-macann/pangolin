import { type Metadata } from 'next';

import { fetchClients } from '@/lib/data/client';

import { Clients } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

// instant = false: fully request-time client list
export const instant = false;

export default async function Page() {
	const clients = await fetchClients();
	return <Clients initial={clients} />;
}
