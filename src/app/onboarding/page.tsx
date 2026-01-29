import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/auth';
import { Button } from '@/ui/button';

export const metadata: Metadata = {
	title: 'Welcome',
};

export default async function Page() {
	const session = await getSession();
	if (!session) redirect('/auth/login');

	return (
		<div className='flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
			<h1 className='mb-2 font-bold text-xl'>
				{session.user.name ? `Hi, ${session.user.name}` : 'Welcome'}
			</h1>
			<div className='text-muted-foreground'>
				Invoicer is a dead-simple platform for managing your income as a sole-trader.
			</div>
			<Button className='mt-4 self-start'>Get started</Button>
		</div>
	);
}
