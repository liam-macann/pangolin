'use client';

import { AnimatePresence } from 'motion/react';

import { type Data as ClientData } from '@/api/clients/route';
import { useClients } from '@/lib/hooks';
import { type ElementType } from '@/lib/utils';

import { MaintainHeight } from '@/components/maintain-height';

import { Card, Table } from './table';

type Client = ElementType<ClientData>;

export function Clients({ initial }: { initial: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	const favorites = data.filter(client => client.isFavorite);

	return (
		<>
			{favorites.length > 0 && (
				<>
					<section className='no-scrollbar flex snap-x gap-4 max-lg:-mx-6 max-lg:scroll-px-6 max-lg:overflow-scroll max-lg:px-6 lg:grid lg:grid-cols-4'>
						<AnimatePresence mode='popLayout' initial={false}>
							{favorites.map(client => (
								<Card
									key={client.id}
									client={client}
									className='shrink-0 basis-60 snap-start max-lg:max-w-[90%]'
									variant='secondary'
								/>
							))}
						</AnimatePresence>
					</section>

					<hr className='my-12' />
				</>
			)}

			<MaintainHeight>
				<Table data={data} />
			</MaintainHeight>
		</>
	);
}
