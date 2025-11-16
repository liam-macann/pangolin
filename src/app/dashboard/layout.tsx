import { SignOutIcon, SlidersHorizontalIcon } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { Suspense } from 'react';
import { auth, type Session, signOut } from '@/auth';
import SideNav from '@/src/app/ui/dashboard/topnav';
import UserAvatar, { AvatarEmpty } from '@/ui/avatar';
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
		<div className='min-h-screen text-foreground'>
			<header className='gap-y-4 border-b py-4'>
				<div className='mx-auto flex max-w-5xl flex-col px-6'>
					<div className='self-end'>
						<Suspense fallback={<Trigger aria-disabled image={null} />}>
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
	if (!session?.user) return <AvatarEmpty />;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Trigger image={session.user.image} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuLabel>
					<h2>{session.user.name}</h2>
					<span className='font-normal text-muted-foreground text-sm'>{session.user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href='/dashboard/settings'>
						<SlidersHorizontalIcon />
						Settings
					</Link>
				</DropdownMenuItem>
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

const Trigger = ({
	image,
	...props
}: { image: Session['user']['image'] } & React.ComponentProps<typeof Button>) => (
	<Button
		variant='ghost'
		className='relative m-0 size-8 cursor-pointer overflow-hidden rounded-full p-0'
		{...props}
	>
		<UserAvatar className='absolute inset-0' image={image} />
		<div className='sr-only'>Account</div>
	</Button>
);
