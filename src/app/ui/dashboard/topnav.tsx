'use client';

import clsx from 'clsx';
import Link from 'next/link';

export default function TopNav({ className }: { className?: string }) {
	const pathname = usePathname();

	return (
		<nav className={clsx('-mx-3 -my-1.5 flex items-baseline', className)}>
			{links.map(link => {
				return (
					<Button
						key={link.name}
						variant='ghost'
						size='sm'
						className={clsx(
							'relative focus:z-10',
							pathname === link.href
								? 'after:-bottom-2.5 after:pointer-events-none after:absolute after:left-0 after:block after:h-[2px] after:w-full after:translate-y-full after:bg-accent-foreground'
								: 'text-muted-foreground',
						)}
						nativeButton={false}
						render={<Link href={link.href}>{link.name}</Link>}
					/>
				);
			})}
		</nav>
	);
}

import { usePathname } from 'next/navigation';
import { Button } from '@/src/components/ui/button';

// Map of links to display in the navigation.
const links = [
	{
		name: 'Invoices',
		href: '/dashboard/invoices',
	},
	{ name: 'Clients', href: '/dashboard/clients' },
];
