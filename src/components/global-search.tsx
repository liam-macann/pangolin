'use client';

import { ArrowElbowDownLeftIcon, MagnifyingGlassIcon, UserCircleIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { type ComponentProps, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { toast } from 'sonner';

import { useClients, useConfig, useInvoices, useIsAppleDevice, useKeyPress } from '@/lib/hooks';
import { formatCurrency, pluralize } from '@/lib/utils';

import { Button } from '@/ui/button';
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/ui/command';
import { Kbd } from '@/ui/kbd';

function GlobalSearch() {
	const [open, setOpen] = useState(false);

	useKeyPress({
		'$mod+k': e => {
			e.preventDefault();
			setOpen(true);
		},
		'/': e => {
			e.preventDefault();
			setOpen(true);
		},
	});

	return (
		<ErrorBoundary
			onError={() => toast.error('Something went wrong. Please try again later.')}
			fallback={<Trigger disabled />}
		>
			<Trigger onClick={() => setOpen(true)} />
			<CommandDialog
				title='Search'
				description='Find people or invoices…'
				open={open}
				onOpenChange={setOpen}
				render={<nav />}
			>
				<Command>
					<CommandInput placeholder='Search for people or invoices…' />
					<Items onOpenChange={setOpen} />
					<footer className='flex items-center gap-2 border-input/30 border-t px-4 py-2 pb-2.5 text-muted-foreground text-xs'>
						<Kbd className='size-5'>
							<ArrowElbowDownLeftIcon aria-label='Enter' />
						</Kbd>
						Enter to navigate
					</footer>
				</Command>
			</CommandDialog>
		</ErrorBoundary>
	);
}

function Items({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
	const clients = useClients();
	const invoices = useInvoices();
	const config = useConfig();

	const router = useRouter();

	if (config.isLoading || clients.isLoading)
		return (
			<CommandList>
				<CommandEmpty className='animate-pulse font-medium'>Loading…</CommandEmpty>
			</CommandList>
		);

	if (!config.data)
		return (
			<CommandList>
				<CommandEmpty>Failed to load configuration.</CommandEmpty>
			</CommandList>
		);
	const { locale } = config.data;

	return (
		<CommandList>
			<CommandEmpty>No results found.</CommandEmpty>
			<CommandGroup heading='Clients'>
				{clients.data?.map(client => (
					<CommandItem
						key={client.id}
						className='*:last:hidden'
						onSelect={() => {
							router.push(`/dashboard/clients/${client.id}`);
							onOpenChange(false);
						}}
					>
						<UserCircleIcon className='-translate-x-px text-muted-foreground' />
						<div className='flex w-full gap-2'>
							<span>{client.data.name}</span>
							<span className='grow text-right text-muted-foreground'>
								{`${client.invoiceCount || 'No'} ${pluralize(client.invoiceCount, 'invoice', 'invoices')}`}
							</span>
						</div>
					</CommandItem>
				))}
			</CommandGroup>

			{/* Allow invoices to populate after clients appear */}
			<CommandGroup heading='Invoices'>
				{invoices.data?.map(invoice => (
					<CommandItem
						key={invoice.id}
						className='flex w-full items-baseline gap-2 *:last:hidden'
						onSelect={() => router.push(`/dashboard/invoices/${invoice.id}`)}
					>
						<span className='font-medium text-xs tabular-nums group-not-data-selected/command-item:text-muted-foreground'>
							{invoice.reference}
						</span>
						<span>{invoice.clientData.name}</span>
						<span className='grow text-right text-muted-foreground'>
							{formatCurrency(invoice.grossTotal, invoice.config.currency, locale)}
						</span>
					</CommandItem>
				))}
			</CommandGroup>
		</CommandList>
	);
}

const Trigger = ({ ...props }: ComponentProps<typeof Button>) => {
	const isApple = useIsAppleDevice();

	return (
		<Button
			variant='outline'
			className='scale-100! rounded-full bg-none font-normal text-muted-foreground'
			size='sm'
			{...props}
		>
			<MagnifyingGlassIcon />
			Search…
			<Kbd className='-mr-1 rounded-full px-1.5 shadow-xs ring ring-input/50'>
				{isApple ? '⌘ K' : 'Ctrl + K'}
			</Kbd>
		</Button>
	);
};

export default GlobalSearch;
