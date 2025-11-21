import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchClients } from '@/lib/data';
import { Button } from '@/ui/button';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const client = await fetchClients(id).catch(() => notFound());

	return (
		<div className='w-full'>
			<Button variant='ghost' asChild className='-ml-4'>
				<Link href='/dashboard/clients'>← Back</Link>
			</Button>
			<h1 className='mt-4 font-display text-3xl'>{client.data.name}</h1>

			<p className='mt-2 text-muted-foreground'>{client.data.email}</p>
		</div>
	);
}
