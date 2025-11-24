import { ArchiveIcon, ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InfoTip } from '@/components/info';
import { fetchClientStats, fetchClients, fetchInvoicesForClient, getUserConfig } from '@/lib/data';
import { formatCurrency, pluralize } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Table } from './ui';

export const metadata: Metadata = {
	title: 'Clients',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const [config, client, invoices, stats] = await Promise.all([
		getUserConfig(),
		fetchClients(id),
		fetchInvoicesForClient(id, 5),
		fetchClientStats(id),
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
							stats.totals.length - 1 > 0 && (
								<span className='ml-auto'>
									+{stats.totals.length - 1} more{' '}
									{pluralize(stats.totals.length - 1, 'currency', 'currencies')}
								</span>
							)
						}
					>
						{formatCurrency(stats.totals[0].grossSum, stats.totals[0].currency, config.locale)}
					</StatCard>
					<StatCard
						title='Outstanding (gross)'
						footer={
							stats.totals.length - 1 > 0 && (
								<span className='ml-auto'>
									+{stats.totals.length - 1} more{' '}
									{pluralize(stats.totals.length - 1, 'currency', 'currencies')}
								</span>
							)
						}
					>
						{formatCurrency(
							stats.totals[0].grossOutstanding,
							stats.totals[0].currency,
							config.locale,
						)}
					</StatCard>
				</div>
			</section>

			<section className='mt-16'>
				<h2 className='mb-4 font-display font-semibold text-2xl'>Recent activity</h2>
				<p></p>
				<Table data={invoices} />
			</section>
		</>
	);
}

function StatCard({
	title,
	children,
	footer,
}: {
	title?: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
}) {
	return (
		<div className='mt-8 flex flex-col gap-1 rounded-md border bg-card p-6 py-4 font-medium text-xl'>
			{title && <p className='flex text-muted-foreground text-sm'>{title}</p>}
			<div className='flex grow flex-col justify-center'>{children}</div>
			{footer && <p className='flex text-muted-foreground text-sm'>{footer}</p>}
		</div>
	);
}
