'use client';

import { DotsThreeIcon, MagnifyingGlassIcon, StarIcon } from '@phosphor-icons/react/ssr';
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Data as ClientData } from '@/api/clients/route';
import { updateClientFavorite } from '@/lib/actions/client';
import { useClients } from '@/lib/hooks';
import { cn, type ElementType, pluralize } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Input } from '@/ui/input';
import { Toggle } from '@/ui/toggle';

type Client = ElementType<ClientData>;

const columns: ColumnDef<Client>[] = [
	{
		accessorKey: 'isFavorite',
		id: 'isFavorite',
		filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
	},
	{
		accessorKey: 'data.name',
		header: 'Name',
	},
	{
		accessorKey: 'data.email',
		header: 'Email',
	},
	{
		accessorKey: 'invoiceCount',
		header: 'Invoices',
	},
];

export function Clients({ initial }: { initial: Client[] }) {
	const { data } = useClients(initial, { suspense: true });
	const favorites = data.filter(client => client.isFavorite);

	return (
		<>
			{favorites.length > 0 && (
				<>
					<section className='grid grid-cols-4 gap-4'>
						<AnimatePresence mode='popLayout' initial={false}>
							{favorites.map(client => (
								<Card key={client.id} client={client} variant='primary' />
							))}
						</AnimatePresence>
					</section>

					<hr className='my-12' />
				</>
			)}

			<Table data={data} />
		</>
	);
}

export function Table({ data }: { data: Client[] }) {
	const [filter, setFilter] = useState('');
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
		{ id: 'isFavorite', value: false },
	]);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			globalFilter: filter,
			columnFilters,
		},
		onGlobalFilterChange: val => {
			setColumnFilters(val === '' ? [{ id: 'isFavorite', value: false }] : []);
			setFilter(val);
		},
		onColumnFiltersChange: setColumnFilters,
	});

	return (
		<>
			<Input
				className='mb-6 h-10 grow rounded-full shadow-none'
				aria-label='Search'
				placeholder='Search clients…'
				onChange={e => table.setGlobalFilter(e.target.value)}
				value={filter}
				prefix={<MagnifyingGlassIcon />}
			/>

			{table.getRowModel().rows.length ? (
				<section className='grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
					<AnimatePresence mode='popLayout' initial={false}>
						{table.getRowModel().rows.map((client, i) => (
							<Card
								style={{ zIndex: table.getRowCount() - i }}
								key={client.id}
								client={client.original}
							/>
						))}
					</AnimatePresence>
				</section>
			) : (
				<div className='py-6 text-center text-muted-foreground'>No results</div>
			)}
		</>
	);
}

function Card({
	client,
	className,
	ref,
	variant = 'outline',
	...props
}: {
	client: Client;
	ref?: React.Ref<HTMLDivElement>;
	variant?: 'primary' | 'outline';
} & HTMLMotionProps<'div'>) {
	const { mutate } = useClients();

	const setFavorite = (v: boolean) => {
		const id = client.id;
		mutate(
			async curr => {
				await updateClientFavorite(id, v).catch(err => {
					toast.error('Failed to update client. Please try again later.');
					throw err;
				});

				return curr?.map(item => (item.id === id ? { ...item, isFavorite: v } : item));
			},
			{
				optimisticData: curr =>
					curr ? curr.map(item => (item.id === id ? { ...item, isFavorite: v } : item)) : [],
			},
		);
	};

	return (
		<motion.div
			initial={{ scale: 0.95, opacity: 0, filter: 'blur(2px)', pointerEvents: 'none' }}
			animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', pointerEvents: 'auto' }}
			exit={{ scale: 0.95, opacity: 0, filter: 'blur(1px)', pointerEvents: 'none' }}
			transition={{
				default: { mass: 0.2, stiffness: 150, damping: 10, type: 'spring' },
				opacity: { duration: 0.2, ease: 'easeOut' },
				filter: { duration: 0.2, ease: 'easeOut' },
			}}
			key={client.id}
			layout='position'
			ref={ref}
			className={cn(
				'relative flex flex-col',
				variant === 'primary' && 'text-primary-foreground',
				className,
			)}
			{...props}
		>
			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size='icon-sm' variant='ghost' className={cn('relative z-10 mx-2 translate-y-2')}>
						<DotsThreeIcon />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent side='left' align='start'>
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem onClick={() => setFavorite(!client.isFavorite)}>
						{client.isFavorite ? 'Unpin client' : 'Pin client'}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Link
				href={`clients/${client.id}`}
				className={cn(
					'-my-8 !pt-12',
					'relative inset-0 flex h-full flex-col justify-end rounded-md border p-4 outline-none ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]',
					variant === 'outline' && 'bg-card',
					variant === 'primary' && 'border-black/20 bg-primary',
				)}
			>
				<h2 className='font-medium'>{client.data.name}</h2>
				<p
					className={cn(
						'translate-y-0.5', // Optical alignment with star
						'text-sm opacity-70',
					)}
				>
					{client.invoiceCount || 'No'} {pluralize(client.invoiceCount, 'invoice', 'invoices')}
				</p>
			</Link>

			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<Toggle
				pressed={client.isFavorite}
				onClick={e => e.stopPropagation}
				onPressedChange={setFavorite}
				size='icon-sm'
				variant='ghost'
				className={cn(
					'-translate-y-2 relative z-10 mx-2 self-end',
					client.isFavorite && '!bg-transparent',
					variant === 'outline' && 'text-muted-foreground',
					variant === 'primary' && '!text-primary-foreground',
				)}
			>
				<span className='sr-only'>Favourite</span>
				<StarIcon weight={client.isFavorite ? 'fill' : undefined} className={cn()} />
			</Toggle>
		</motion.div>
	);
}
