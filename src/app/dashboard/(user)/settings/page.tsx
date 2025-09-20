import { auth } from '@/auth';
import { getUserConfig } from '@/lib/data';
import Avatar from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Combobox } from '@/ui/combobox';

export default async function Page() {
	const session = await auth();
	if (!session?.user) return null;

	const config = await getUserConfig();

	return (
		<div>
			<h1 className='mb-12 font-display text-3xl'>Settings</h1>

			<div className='flex gap-6'>
				<nav className='-ml-4 flex w-64 flex-col items-start'>
					<Button
						disabled
						className='!opacity-100 font-semibold text-base text-foreground'
						variant='ghost'
					>
						General
					</Button>
				</nav>
				<section className='flex w-full flex-col gap-12'>
					<div>
						<div className='flex items-center gap-12 rounded-lg border bg-card p-6 px-8'>
							<Avatar className='size-12' email={session.user.email} />
							<div className='flex flex-col'>
								<p className='font-semibold text-lg'>{session.user.name}</p>
								<p className='text-muted-foreground'>{session.user.email}</p>
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

					<div>
						<h2 className='font-semibold text-lg'>Time zone</h2>
						<p className='text-muted-foreground'>
							Your time zone of record, which affects the time displayed in your invoices and the
							calculation of figures.
						</p>
						<Combobox
							value={config.timeZone}
							disabled
							className='mt-4'
							options={[{ label: 'Sydney, Australia', value: 'Australia/Sydney' }]}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
