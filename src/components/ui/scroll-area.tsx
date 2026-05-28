'use client';

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';

import { cn } from '@/lib/utils';

function ScrollArea({
	className,
	children,
	fade = false,
	...props
}: ScrollAreaPrimitive.Root.Props & {
	fade?:
		| boolean
		| ({ x?: boolean; y?: boolean } & {
				top?: boolean;
				bottom?: boolean;
				left?: boolean;
				right?: boolean;
		  });
}) {
	const isObj = typeof fade === 'object' && fade !== null;

	const hasTop = fade === true || (isObj && (fade?.top ?? fade?.y));
	const hasBottom = fade === true || (isObj && (fade?.bottom ?? fade?.y));
	const hasLeft = fade === true || (isObj && (fade?.left ?? fade?.x));
	const hasRight = fade === true || (isObj && (fade?.right ?? fade?.x));

	return (
		<ScrollAreaPrimitive.Root
			data-slot='scroll-area'
			className={cn('relative', className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot='scroll-area-viewport'
				className='size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50'
				style={
					hasTop || hasBottom || hasLeft || hasRight
						? {
								maskImage: `
									linear-gradient(
										to bottom,
										transparent,
										rgba(0,0,0,0.32),
										black ${hasTop ? 'min(40px, var(--scroll-area-overflow-y-start))' : '0px'},
										black ${hasBottom ? 'calc(100% - min(40px, var(--scroll-area-overflow-y-end, 40px)))' : '100%'},
										rgba(0,0,0,0.32),
										transparent
									),
									linear-gradient(
										to right,
										transparent,
										rgba(0,0,0,0.32),
										black ${hasLeft ? 'min(40px, var(--scroll-area-overflow-x-start))' : '0px'},
										black ${hasRight ? 'calc(100% - min(40px, var(--scroll-area-overflow-x-end, 40px)))' : '100%'},
										rgba(0,0,0,0.32),
										transparent
									)
								`,
								maskRepeat: 'no-repeat, no-repeat',
								maskSize: '100% 100%, 100% 100%',
								maskComposite: 'intersect',
							}
						: undefined
				}
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = 'vertical',
	...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			data-slot='scroll-area-scrollbar'
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				'flex touch-none select-none p-px transition data-horizontal:h-2.5 data-vertical:h-full data-vertical:w-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:border-l data-vertical:border-l-transparent',
				'pointer-events-none opacity-0 not-data-scrolling:delay-400 duration-200 ease-in hover:pointer-events-auto hover:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0',
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				data-slot='scroll-area-thumb'
				className='relative flex-1 rounded-full bg-gray-a-10'
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollArea, ScrollBar };
