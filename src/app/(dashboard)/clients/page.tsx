import { type Metadata } from 'next';

import { clientQueries } from '@/lib/hooks/data/client';
import { PrefetchQuery } from '@/lib/hooks/data/helpers/prefetch';

import { Clients } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

// instant = false: fully request-time client list
export const instant = false;

export default function Page() {
	return (
		<PrefetchQuery queries={[clientQueries.list()]}>
			<Clients />
		</PrefetchQuery>
	);
}
