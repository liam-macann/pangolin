import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import Avatar from '@/ui/avatar';

import { getSession, signOut } from '@/auth';
import { Button } from '@/src/components/ui/button';

export default function UnauthorizedPage() {
	return (
		<main className='flex h-full flex-col items-center justify-center gap-1'>
			<h2 className='text-center font-medium text-lg'>Is this the right account?</h2>
			<p className='text-center text-muted-foreground'>
				You don't have permission to perform this action
			</p>

			<div className='mt-12 grid min-w-lg max-w-full grid-cols-[3.5rem_1fr] items-center gap-6 rounded-lg border bg-card p-6 px-8 sm:gap-x-10'>
				<Suspense
					fallback={
						<>
							<Avatar className='size-14' image={null} />
							<div className='flex animate-pulse flex-col'>
								<p className='h-lh w-32 scale-y-80 rounded bg-muted text-lg'></p>
								<p className='h-lh w-38 scale-y-80 rounded bg-muted'></p>
							</div>
						</>
					}
				>
					<CurrentUser />
				</Suspense>

				<Button
					className='col-start-2 justify-self-start'
					onClick={async () => {
						'use server';
						await signOut({ headers: await headers() });
						redirect('/auth/login');
					}}
				>
					Switch user
				</Button>
			</div>
		</main>
	);
}

async function CurrentUser() {
	const session = await getSession();

	return (
		session && (
			<>
				<Avatar className='size-14' image={session.user.image || null} />
				<div className='flex flex-col'>
					<p className='font-semibold text-lg'>{session.user.name}</p>
					<p className='text-muted-foreground'>{session.user.email}</p>
				</div>
			</>
		)
	);
}
