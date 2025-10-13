import { getUserConfig } from '@/lib/data';
import Avatar from '@/ui/avatar';
import { Button } from '@/ui/button';
import ConfigForm from './form';

export default async function Page() {
	// Includes auth
	const config = await getUserConfig();

	return (
		<>
			<h1 className='mb-12 font-display text-3xl' id='top'>
				Settings
			</h1>

			<div className='gap-6 md:flex'>
				<nav className='-ml-3 flex w-64 flex-col items-start gap-1 max-md:hidden'>
					<Button size='sm' className='text-foreground text-sm' variant='ghost' asChild>
						<a href='#top'>General</a>
					</Button>
					<Button size='sm' className='text-foreground text-sm' variant='ghost' asChild>
						<a href='#taxation'>Taxation</a>
					</Button>
					<Button size='sm' className='text-foreground text-sm' variant='ghost' asChild>
						<a href='#localisation'>Localisation</a>
					</Button>
				</nav>
				<section className='mb-12 flex w-full flex-col gap-12'>
					<div>
						<div className='flex items-center gap-12 rounded-lg border bg-card p-6 px-8'>
							<Avatar className='size-12' email={config.user.email} />
							<div className='flex flex-col'>
								<p className='font-semibold text-lg'>{config.user.name}</p>
								<p className='text-muted-foreground'>{config.user.email}</p>
							</div>
						</div>

						<p className='mt-3 text-muted-foreground text-sm'>
							You may update your profile picture on{' '}
							<a className='link' href='https://gravatar.com/'>
								Gravatar
							</a>{' '}
							or{' '}
							<a className='link' href='https://libravatar.org/'>
								Libravatar
							</a>
							.
						</p>
					</div>

					<hr />

					<ConfigForm config={config} />
				</section>
			</div>
		</>
	);
}
