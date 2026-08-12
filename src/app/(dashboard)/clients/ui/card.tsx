'use client';

import { BuildingOfficeIcon, DotsThreeIcon, StarIcon } from '@phosphor-icons/react/ssr';
import { type HTMLMotionProps, motion } from 'motion/react';
import Link from 'next/link';

import { type Data as ClientData } from '@/api/clients/route';
import { cn, type ElementType, pluralize } from '@/lib/utils';

import { Button } from '@/ui/button';
import { Toggle } from '@/ui/toggle';

type Client = ElementType<ClientData>;

import { OverflowMenu, useClientActions } from './menu';
export function Card({
	client,
	className,
	ref,
	variant = 'outline',
	...props
}: {
	client: Client;
	ref?: React.Ref<HTMLDivElement>;
	variant?: 'secondary' | 'outline';
} & HTMLMotionProps<'div'>) {
	const { setFavorite } = useClientActions(client);

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
				'relative flex flex-col text-muted-foreground text-sm leading-tight',
				className,
			)}
			{...props}
		>
			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<OverflowMenu
				side='left'
				align='start'
				client={client}
				render={
					<Button
						size='icon-xs'
						variant='ghost'
						className='absolute top-3 left-3 z-10 text-inherit'
					>
						<DotsThreeIcon />
					</Button>
				}
			/>

			<Link
				href={`clients/${client.id}`}
				className={cn(
					'grid size-full grid-rows-[3rem_1lh] pt-9!',
					'rounded-md border p-4 outline-none focus-visible:border-ring focus-visible:ring-2',
					'bg-card',
					variant === 'secondary' && 'bg-secondary',
				)}
			>
				<div className='wrap-normal flex max-h-full flex-col justify-end gap-1'>
					{client.data.organization && client.data.name && (
						<p className='flex items-baseline gap-1'>
							<BuildingOfficeIcon className='relative top-[0.125em] shrink-0' />
							<span className='line-clamp-1'>{client.data.organization}</span>
						</p>
					)}

					<h2
						className={cn(
							'font-medium text-base text-foreground leading-tight',
							client.data.organization ? 'line-clamp-1' : 'line-clamp-2',
						)}
					>
						{client.data.name || (
							<div className='flex items-baseline gap-1.5'>
								<BuildingOfficeIcon className='relative top-[0.125em] shrink-0' />
								<span className='line-clamp-2'>{client.data.organization}</span>
							</div>
						)}
					</h2>
				</div>

				<p
					// Wrap before text hits star
					className='row-start-2 mt-auto pr-6'
					style={{ textBox: 'trim-end cap alphabetic' }}
				>
					{client.invoiceCount || 'No'} {pluralize(client.invoiceCount, 'invoice', 'invoices')}
				</p>
			</Link>

			{/* Outside of Link for semantics: <button> may not be within <a> */}
			<Toggle
				pressed={client.isFavorite}
				onClick={e => e.stopPropagation()}
				onPressedChange={setFavorite}
				size='icon-xs'
				variant='ghost'
				className={cn(
					'absolute right-3 bottom-3 translate-y-px',
					client.isFavorite && 'bg-transparent!',
					'text-muted-foreground',
				)}
			>
				<span className='sr-only'>Favourite</span>
				<StarIcon
					weight={client.isFavorite ? 'fill' : undefined}
					className={cn('scale-95', client.isFavorite && 'text-primary')}
				/>
			</Toggle>
		</motion.div>
	);
}
