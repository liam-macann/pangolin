'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
} from '@/ui/dropdown-menu';
import { toast } from '@/ui/toast';

export function TopNav({ links, className }: { links: Map<string, string>; className?: string }) {
	return (
		<nav className={cn('-mx-3 -my-1.5 flex items-baseline', className)}>
			{links.entries().map(([name, href]) => (
				<Suspense key={name} fallback={<NavLink name={name} href={href} active={false} />}>
					<ActiveNavLink name={name} href={href} />
				</Suspense>
			))}
		</nav>
	);
}

function ActiveNavLink({ name, href }: { name: string; href: string }) {
	const pathname = usePathname();
	return <NavLink name={name} href={href} active={pathname === href} />;
}

function NavLink({ name, href, active }: { name: string; href: string; active: boolean }) {
	return (
		<Button
			variant='ghost'
			size='sm'
			className={cn(
				'relative focus:z-10',
				active
					? 'after:pointer-events-none after:absolute after:-bottom-2.5 after:left-0 after:block after:h-0.5 after:w-full after:translate-y-full after:bg-primary dark:after:bg-foreground'
					: 'text-muted-foreground',
			)}
			nativeButton={false}
			render={
				<Link href={href} prefetch>
					{name}
				</Link>
			}
		/>
	);
}

export function FeedbackSubmenu({ name, email }: { name: string; email: string }) {
	const [value, setValue] = useState('');
	const message = value.trim();

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>Feedback</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				keepMounted
				className='flex flex-col gap-1'
				render={
					<form
						onSubmit={e => {
							e.preventDefault();

							if (!message) {
								toast.error('Please enter a message');
								return;
							}

							Sentry.captureFeedback({
								name: name,
								email: email,
								message,
							});

							toast.success('Thank you for sharing your thoughts');

							setValue('');
						}}
					/>
				}
			>
				<DropdownMenuSubContentTextarea
					value={value}
					onChange={e => setValue(e.currentTarget.value)}
					name='feedback'
					label='Tell us what you think'
					onKeyDown={e => {
						console.log(e.currentTarget.form);
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							e.currentTarget.form?.requestSubmit();
						}
					}}
				/>

				<Button variant='primary' size='sm' type='submit' disabled={!message}>
					Submit
				</Button>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
