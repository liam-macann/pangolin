import { SignOutIcon } from '@phosphor-icons/react/ssr';
import { Suspense } from 'react';
import { auth, signOut } from '@/auth';
import SideNav from '@/src/app/ui/dashboard/topnav';
import Avatar from '@/ui/avatar';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className='min-h-screen bg-background text-foreground'>
			<header className='gap-y-4 border-b py-4'>
				<div className='mx-auto flex max-w-5xl flex-col px-6'>
					<div className='self-end'>
						<Suspense
							fallback={
								<Button
									variant='ghost'
									aria-disabled
									className='!bg-gray-4 relative size-8 animate-pulse cursor-pointer overflow-hidden rounded-full'
								>
									<div className='sr-only'>Account</div>
								</Button>
							}
						>
							<AccountMenuContent />
						</Suspense>
					</div>

					<SideNav />
				</div>
			</header>
			<main className='mx-auto max-w-5xl px-6 py-12'>{children}</main>
		</div>
	);
}

async function AccountMenuContent() {
	const session = await auth();
	if (!session?.user) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					className='!bg-gray-4 relative size-8 cursor-pointer overflow-hidden rounded-full'
				>
					<Avatar email={session.user.email || ''} />
					<div className='sr-only'>Account</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuLabel>
					<h2>{session.user.name}</h2>
					<span className='font-normal text-muted-foreground text-sm'>{session.user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={async () => {
						'use server';
						await signOut({ redirectTo: '/' });
					}}
				>
					<SignOutIcon />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
