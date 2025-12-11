import { ArchiveIcon, ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { InfoTip } from '@/components/info';
import { getUserConfig } from '@/lib/data';
import { fetchClientStats, fetchClients } from '@/lib/data/client';
import { fetchInvoicesForClient } from '@/lib/data/invoice';
import { cn, formatCurrency, pluralize } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Table } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const [client, invoices, config] = await Promise.all([
		fetchClients(id),
		fetchInvoicesForClient(id, 5),
		getUserConfig().catch(() => redirect('/onboarding')),
	]).catch(err => {
		console.error(err);
		notFound();
	});

	return (
		<>
			<Button variant='ghost' asChild className='-ml-3'>
				<Link href='/dashboard/clients'>
					<ArrowLeftIcon />
					Back
				</Link>
			</Button>

			<section className='flex flex-col gap-2'>
				<div className='space-x-4'>
					<h1 className='mt-4 inline-block font-display text-3xl'>{client.data.name}</h1>
					{client.isDeleted && (
						<Badge variant='outline' className='-translate-0.5'>
							<ArchiveIcon /> Archived
						</Badge>
					)}
				</div>

				{/*<p className='text-muted-foreground'>{client.data.email}</p>*/}

				<div className='grid grid-cols-3 gap-2'>
					<Suspense
						fallback={
							<>
								<StatCard title='Valid issuances'>
									<div className='my-1 h-[1em] w-24 animate-pulse rounded bg-muted' />
								</StatCard>
								<StatCard
									title={
										<span className='flex w-full items-center justify-between'>
											Gross total<InfoTip side='top'>Excludes void and refunded invoices</InfoTip>
										</span>
									}
								>
									<div className='my-1 h-[1em] w-24 animate-pulse rounded bg-muted' />
								</StatCard>
								<StatCard title='Outstanding (gross)'>
									<div className='my-1 h-[1em] w-24 animate-pulse rounded bg-muted' />
								</StatCard>
							</>
						}
					>
						<SummaryCards id={id} />
					</Suspense>
				</div>
			</section>
			<section className='mt-16'>
				<h2 className='mb-6 font-display font-semibold text-2xl'>Recent activity</h2>
				<Table locale={config.locale} data={invoices} />

				{client.invoiceCount > 5 && (
					<div className='mt-3 ml-4 rounded-md font-medium text-muted-foreground text-sm'>
						+ {client.invoiceCount - 5} more{' '}
						{pluralize(client.invoiceCount - 5, 'invoice', 'invoices')}
					</div>
				)}
			</section>
		</>
	);
}

function StatCard({
	title,
	children,
	footer,
	className,
}: {
	title?: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'mt-8 flex flex-col gap-1 rounded-md border bg-card p-6 py-4 font-medium text-xl',
				className,
			)}
		>
			{title && <p className='flex text-muted-foreground text-sm'>{title}</p>}
			<div className='flex grow flex-col justify-center text-xl'>{children}</div>
			{footer && <p className='flex text-muted-foreground text-sm'>{footer}</p>}
		</div>
	);
}

async function SummaryCards({ id }: { id: string }) {
	const [config, stats] = await Promise.all([getUserConfig(), fetchClientStats(id)]);

	return (
		<>
			<StatCard title='Valid issuances'>
				{stats.validCount} {pluralize(stats.validCount, 'invoice', 'invoices')}
			</StatCard>
			<StatCard
				title={
					<span className='flex w-full items-center justify-between'>
						Gross total<InfoTip side='top'>Excludes void and refunded invoices</InfoTip>
					</span>
				}
				footer={
					stats.totals &&
					stats.totals.length - 1 > 0 && (
						<span className='ml-auto'>
							+{stats.totals.length - 1} more{' '}
							{pluralize(stats.totals.length - 1, 'currency', 'currencies')}
						</span>
					)
				}
			>
				{stats.totals
					? formatCurrency(stats.totals[0].grossSum, stats.totals[0].currency, config.locale)
					: '–'}
			</StatCard>
			<StatCard
				title='Outstanding (gross)'
				footer={
					stats.totals &&
					stats.totals.length - 1 > 0 && (
						<span className='ml-auto'>
							+{stats.totals.length - 1} more{' '}
							{pluralize(stats.totals.length - 1, 'currency', 'currencies')}
						</span>
					)
				}
				className={cn(stats.totals && stats.totals[0].grossOutstanding > 0 && 'text-destructive')}
			>
				{stats.totals
					? formatCurrency(
							stats.totals[0].grossOutstanding,
							stats.totals[0].currency,
							config.locale,
						)
					: '–'}
			</StatCard>
		</>
	);
}
