import { SignOutIcon } from '@phosphor-icons/react/ssr';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import GlobalSearch from '@/components/global-search';
import UserAvatar, { AvatarEmpty } from '@/ui/avatar';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

import { getSession, signOut } from '@/auth';

import { FeedbackSubmenu, TopNav } from './layout-ui';

const isDevelopment = process.env.NODE_ENV === 'development';

// Map of links to display in the navigation
const links = new Map([
	['Invoices', '/invoices'],
	['Clients', '/clients'],
]);

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className='min-h-screen text-foreground'>
			<header className='gap-y-4 border-b py-4'>
				<div className='mx-auto flex max-w-5xl flex-col px-6'>
					<div className='flex items-center gap-3 self-end'>
						<GlobalSearch />
						<Suspense fallback={<AccountMenuTrigger aria-disabled image={null} />}>
							<AccountMenuContent />
						</Suspense>
					</div>
					<TopNav links={links} />
				</div>
			</header>
			<main className='mx-auto max-w-5xl px-6 py-12 pb-24'>{children}</main>
		</div>
	);
}

async function AccountMenuContent() {
	const session = await getSession();
	if (!session) return <AvatarEmpty className='size-8' />;

	return (
		// Menu is just disabled when an error occurs.
		<ErrorBoundary fallback={<AccountMenuTrigger image={session.user.image} />}>
			<DropdownMenu>
				<DropdownMenuTrigger render={<AccountMenuTrigger image={session.user.image} />} />
				<DropdownMenuContent sideOffset={10} className='w-auto' align='end'>
					<DropdownMenuGroup>
						<DropdownMenuLabel>
							<h2>{session.user.name}</h2>
							<span className='font-normal text-muted-foreground text-sm'>
								{session.user.email}
							</span>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{isDevelopment && (
							<DropdownMenuItem render={<Link href='/docs/api'>API Reference</Link>} />
						)}
						<DropdownMenuItem render={<Link href='/settings'>Settings</Link>} />
						<FeedbackSubmenu name={session.user.name} email={session.user.email} />
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant='destructive'
							onClick={async () => {
								'use server';
								await signOut({ headers: await headers() });
								redirect('/auth/login');
							}}
						>
							<SignOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ErrorBoundary>
	);
}

const AccountMenuTrigger = ({
	image,
	...props
}: { image?: string | null } & React.ComponentProps<typeof Button>) => (
	<Button
		variant='ghost'
		className='relative m-0 size-8 cursor-pointer overflow-hidden rounded-full border-none p-0 ring-offset-2 focus-visible:ring-2'
		{...props}
	>
		<UserAvatar className='absolute inset-0' image={image || null} />
		<div className='sr-only'>Account</div>
	</Button>
);
