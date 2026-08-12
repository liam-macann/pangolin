'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@/src/components/ui/button';

export default function TopNav({ className }: { className?: string }) {
	return (
		<nav className={clsx('-mx-3 -my-1.5 flex items-baseline', className)}>
			{links.map(link => (
				<Suspense key={link.name} fallback={<NavLink link={link} active={false} />}>
					<ActiveNavLink link={link} />
				</Suspense>
			))}
		</nav>
	);
}

function ActiveNavLink({ link }: { link: (typeof links)[number] }) {
	const pathname = usePathname();
	return <NavLink link={link} active={pathname === link.href} />;
}

function NavLink({ link, active }: { link: (typeof links)[number]; active: boolean }) {
	return (
		<Button
			variant='ghost'
			size='sm'
			className={clsx(
				'relative focus:z-10',
				active
					? 'after:pointer-events-none after:absolute after:-bottom-2.5 after:left-0 after:block after:h-0.5 after:w-full after:translate-y-full after:bg-accent-foreground'
					: 'text-muted-foreground',
			)}
			nativeButton={false}
			render={<Link href={link.href}>{link.name}</Link>}
		/>
	);
}

// Map of links to display in the navigation.
const links = [
	{
		name: 'Invoices',
		href: '/invoices',
	},
	{ name: 'Clients', href: '/clients' },
];
