import Link from 'next/link';

import { fetchConfig } from '@/lib/data';

import Avatar from '@/ui/avatar';
import { Button } from '@/ui/button';

import ConfigForm from './form';

export default async function Page() {
	const config = await fetchConfig();

	return (
		<div className='grid-cols-[12rem_auto] gap-x-6 md:grid'>
			<h1 className='col-start-2 mb-12 font-display text-3xl' id='top'>
				Settings
			</h1>

			<nav className='sticky top-8 -ml-3 flex flex-col items-start gap-1 self-start max-md:hidden'>
				<Button
					size='sm'
					className='text-foreground text-sm'
					variant='ghost'
					nativeButton={false}
					render={<Link href='#top'>General</Link>}
				/>
				<Button
					size='sm'
					className='text-foreground text-sm'
					variant='ghost'
					nativeButton={false}
					render={<Link href='#details'>Your details</Link>}
				/>
				<Button
					size='sm'
					className='text-foreground text-sm'
					variant='ghost'
					nativeButton={false}
					render={<Link href='#taxation'>Taxation</Link>}
				/>
				<Button
					size='sm'
					className='text-foreground text-sm'
					variant='ghost'
					nativeButton={false}
					render={<Link href='#localisation'>Localisation</Link>}
				/>
			</nav>
			<section className='mb-12 flex w-full flex-col gap-12'>
				<div>
					<div className='flex items-center gap-6 rounded-lg border bg-card p-6 px-8 sm:gap-10'>
						<Avatar className='size-14' image={config.user.image} />
						<div className='flex flex-col'>
							<p className='font-semibold text-lg'>{config.user.name}</p>
							<p className='text-muted-foreground'>{config.user.email}</p>
						</div>
					</div>

					<p className='mt-3 text-muted-foreground text-sm'>
						You may update your profile picture through your linked identity provider.
					</p>
				</div>

				<hr />

				<ConfigForm config={config} />
			</section>
		</div>
	);
}
