'use client';

import {
	ArrowElbowDownLeftIcon,
	BuildingOfficeIcon,
	MagnifyingGlassIcon,
	UserCircleIcon,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCommandState } from 'cmdk';
import { useRouter } from 'next/navigation';
import { type ComponentProps, type RefObject, Suspense, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { useClients, useConfig, useInvoices, useKeyPress } from '@/lib/hooks';
import { clientQueries } from '@/lib/hooks/data/client';
import { configQueries } from '@/lib/hooks/data/config';
import { prefetch, useFetchNearEnd } from '@/lib/hooks/data/helpers';
import { invoiceQueries } from '@/lib/hooks/data/invoice';
import { pluralize } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';

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
import { toast } from '@/ui/toast';

function GlobalSearch() {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const listRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) setSearch('');
	};

	const prefetchSearch = () => {
		void Promise.allSettled([
			prefetch(queryClient, clientQueries.list()),
			prefetch(queryClient, invoiceQueries.list()),
			prefetch(queryClient, configQueries.current()),
		]);
	};

	const openSearch = () => {
		prefetchSearch();
		setOpen(true);
	};

	useKeyPress({
		'$mod+k': e => {
			e.preventDefault();
			openSearch();
		},
		'/': e => {
			e.preventDefault();
			openSearch();
		},
	});

	return (
		<ErrorBoundary
			onError={() => toast.error('Something went wrong. Please try again later.')}
			fallback={<Trigger disabled />}
		>
			<Trigger onClick={openSearch} onPointerEnter={prefetchSearch} onFocus={prefetchSearch} />
			<CommandDialog
				title='Search'
				description='Find people or invoices…'
				open={open}
				onOpenChange={onOpenChange}
				render={<nav />}
				className='top-1/4 max-h-[calc(75%-(--spacing(12)))]'
			>
				<Command>
					<CommandInput
						placeholder='Search for people or invoices…'
						value={search}
						onValueChange={value => {
							// Commits the new matches, including cmdk scroll, before resetting scroll to top
							flushSync(() => setSearch(value));
							listRef.current?.scrollTo({ top: 0 });
						}}
					/>
					<Suspense
						fallback={
							<CommandList className='overflow-clip'>
								<CommandEmpty className='animate-pulse justify-center py-16 font-medium'>
									Loading…
								</CommandEmpty>
							</CommandList>
						}
					>
						<Items ref={listRef} onNavigate={() => onOpenChange(false)} />
					</Suspense>
					<footer className='sticky bottom-0 flex items-center gap-2 border-t border-dotted bg-background px-4 py-2.5 pb-3 text-muted-foreground text-xs'>
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

function Items({
	ref,
	onNavigate,
}: {
	ref: RefObject<HTMLDivElement | null>;
	/** Called once a result has been chosen and navigated to. */
	onNavigate: () => void;
}) {
	const clients = useClients();
	const invoices = useInvoices();
	const config = useConfig();

	const router = useRouter();

	// Search only filters the loaded items, so keep loading while the end of the list is in view.
	useCommandState(state => state.filtered.count); // Subscribe to match count, to reevaluate on filter
	const fetchClients = useFetchNearEnd(clients, ref);
	// Clients come first, so don't trigger invoices until they are pulled
	const fetchInvoices = useFetchNearEnd(invoices, ref, !clients.hasNextPage);

	if (!config.data)
		return (
			<CommandList>
				<CommandEmpty>Failed to load configuration.</CommandEmpty>
			</CommandList>
		);

	const { locale } = config.data;
	const clientsData = clients.data;
	const invoicesData = invoices.data;

	return (
		<CommandList
			ref={ref}
			onScroll={() => {
				fetchClients();
				fetchInvoices();
			}}
		>
			<CommandEmpty>No results found.</CommandEmpty>
			{!!clientsData?.length && (
				<CommandGroup heading='Clients'>
					{clientsData.map(client => (
						<CommandItem
							key={client.id}
							value={client.id}
							keywords={[client.data.name, client.data.organization].filter(
								(v): v is string => typeof v === 'string',
							)}
							className='*:last:hidden'
							onSelect={() => {
								router.push(`/clients/${client.id}`);
								onNavigate();
							}}
						>
							{client.data.name ? (
								<UserCircleIcon className='-translate-x-px text-muted-foreground' />
							) : (
								<BuildingOfficeIcon className='text-muted-foreground' />
							)}

							<div className='flex w-full gap-2'>
								<span>{client.data.name || client.data.organization}</span>
								<span className='grow text-right text-muted-foreground'>
									{`${client.invoiceCount || 'No'} ${pluralize(client.invoiceCount, 'invoice', 'invoices')}`}
								</span>
							</div>
						</CommandItem>
					))}
				</CommandGroup>
			)}

			{/* Allow invoices to populate after clients appear */}
			{!!invoicesData?.length && (
				<CommandGroup heading='Invoices'>
					{invoicesData.map(invoice => (
						<CommandItem
							key={invoice.id}
							value={invoice.id}
							keywords={[
								invoice.reference,
								invoice.client.name,
								invoice.client.organization,
								formatCurrency(invoice.grossTotal, invoice.currency, locale),
							].filter((v): v is string => typeof v === 'string')}
							className='flex w-full items-baseline gap-2 *:last:hidden'
							onSelect={() => router.push(`/invoices/${invoice.id}`)}
						>
							<span className='font-medium text-xs tabular-nums group-not-data-selected/command-item:text-muted-foreground'>
								{invoice.reference}
							</span>
							<span>{invoice.client.name || invoice.client.organization}</span>
							<span className='grow text-right text-muted-foreground'>
								{formatCurrency(invoice.grossTotal, invoice.currency, locale)}
							</span>
						</CommandItem>
					))}
				</CommandGroup>
			)}
		</CommandList>
	);
}

const Trigger = ({ ...props }: ComponentProps<typeof Button>) => {
	return (
		<Button
			variant='outline'
			className='scale-100! rounded-full bg-none pr-8 font-normal text-muted-foreground'
			size='sm'
			{...props}
		>
			<MagnifyingGlassIcon /> Search…
		</Button>
	);
};

export default GlobalSearch;
