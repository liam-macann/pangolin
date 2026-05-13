'use client';

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { type ComponentProps, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';

import { type Session } from '@/auth';
import ScribbleCircle from '@/src/assets/scribble-circle.svg';

import { Customization } from './forms/customization';
import { Details } from './forms/details';
import { Localization } from './forms/localization';
import { Payment } from './forms/payment';
import { Taxation } from './forms/taxation';
import { useOnboardingStore } from './state';

export interface Geo {
	country: string | null;
	currency: string | null;
	timezone: string | null;
}

function usePrevious<T>(value: T) {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	}, [value]);
	return ref.current;
}

export function Wizard({ session, geo }: { session: Session; geo: Geo }) {
	const page = useOnboardingStore(state => state.page);

	const previousPage = usePrevious(page);
	const direction = page - previousPage;

	const delta = 10;
	const variants = {
		enter: (direction: number) => ({
			x: direction > 0 ? delta : -delta,
			opacity: 0,
			filter: 'blur(1px)',
		}),
		center: {
			x: 0,
			opacity: 1,
			filter: 'none',
			transition: {
				delay: 0.04,
				duration: 0.1,
				ease: [0.23, 1, 0.32, 1] as const,
			},
		},
		exit: (direction: number) => ({
			x: direction < 0 ? delta : -delta,
			opacity: 0,
			filter: 'blur(1px)',
			transition: { duration: 0.08 },
		}),
	};

	const transition = {
		type: 'spring',
		stiffness: 320,
		damping: 20,
		mass: 0.4,
	} as const;

	return (
		<motion.div layout transition={transition}>
			<Progress className='mx-8 mb-6' />

			{/* Controls the expansion and contraction of the card height */}
			<motion.div
				layout
				transition={transition}
				className='relative flex flex-col gap-y-4 overflow-hidden rounded-md border bg-card shadow'
			>
				<AnimatePresence mode='popLayout' initial={false} custom={direction}>
					<motion.div layout transition={transition} className='p-8' key={page}>
						<motion.div
							custom={direction}
							variants={variants}
							initial='enter'
							animate='center'
							exit='exit'
						>
							<Page session={session} geo={geo} page={page} />
						</motion.div>
					</motion.div>
				</AnimatePresence>
			</motion.div>
		</motion.div>
	);
}

function Page({ session, geo, page }: { session: Session; geo: Geo; page: number }) {
	if (page === 0) return <Landing name={session.user.name} />;
	if (page === 1) return <Details session={session} />;
	if (page === 2) return <Localization geo={geo} />;
	if (page === 3) return <Payment />;
	if (page === 4) return <Taxation />;
	if (page === 5) return <Customization />;

	return null;
}

export function Progress({ className, ...props }: ComponentProps<typeof motion.div>) {
	const page = useOnboardingStore(state => state.page);
	const maxPage = useOnboardingStore(state => state.pages);

	return (
		<motion.div
			layout
			className={cn('relative isolate flex justify-between gap-1', className)}
			{...props}
		>
			<span className='sr-only'>Page {page}</span>
			<hr className='absolute top-1/2 -z-10 w-full -translate-y-1/2' />

			{/* Skip the landing card in the page counter */}
			{Array.from({ length: maxPage - 1 }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: Element indicates page index
					key={i}
					aria-hidden
					className={cn(
						'group/step relative size-6 rounded border outline-8 outline-gray-2 transition-colors ease-out-quint dark:outline-gray-1',
						'inset-shadow-xs flex items-center justify-center bg-muted font-semibold text-muted-foreground text-xs',
						i === page - 1 && 'bg-primary text-primary-foreground',
					)}
				>
					{i + 1}

					{i === page - 1 && (
						<ScribbleCircle
							className='filter-pencil fade-in-0 absolute -inset-3 animate-in fill-foreground/50 group-even/step:rotate-150 group-nth-[3n]/step:rotate-45'
							role='presentation'
						/>
					)}
				</div>
			))}
		</motion.div>
	);
}

export function Footer({ next }: { next: ComponentProps<typeof Button>['render'] }) {
	const page = useOnboardingStore(state => state.page);
	const maxPage = useOnboardingStore(state => state.pages);
	const previous = useOnboardingStore(state => state.previous);
	const isSubmitting = useOnboardingStore(state => state.isSubmitting);

	return (
		<footer className='mt-16 grid grid-cols-3 items-center'>
			<Button
				className='-mx-3 justify-self-start'
				variant='ghost'
				disabled={page === 0}
				onClick={() => previous()}
				aria-label='Previous'
			>
				<CaretLeftIcon /> Back
			</Button>
			<div className='flex justify-center gap-1'>
				<span className='sr-only'>Page {page}</span>
				{/* Skip the landing card in the page counter */}
				{Array.from({ length: maxPage - 1 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: Element indicates page index
						key={i}
						aria-hidden
						className={cn(
							'size-1.5 scale-75 rounded-full bg-border',
							i === page - 1 && 'scale-100 bg-primary',
						)}
					/>
				))}
			</div>

			<Button
				render={next}
				variant='primary'
				disabled={isSubmitting}
				className={cn('justify-self-end', isSubmitting && 'cursor-progress')}
			>
				Next <CaretRightIcon />
			</Button>
		</footer>
	);
}

function Landing({ name }: { name?: string }) {
	const next = useOnboardingStore(state => state.next);
	return (
		<>
			<h1 className='mb-2 font-bold text-xl'>{name ? `Hi, ${name}` : 'Welcome'}</h1>
			<div className='text-muted-foreground'>
				Invoicer is a simple solution to manage your income. Before getting started, we have a
				couple of questions to ask.
			</div>
			<Button className='mt-8 self-start' size='lg' onClick={next}>
				Get started
			</Button>
		</>
	);
}
