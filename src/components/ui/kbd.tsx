import { useIsAppleDevice } from '@/lib/hooks/utils';
import { cn } from '@/lib/utils';

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
	return (
		<kbd
			data-slot='kbd'
			className={cn(
				"pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-accent/50 in-data-[slot=tooltip-content]:bg-background/20 px-1 font-medium font-sans in-data-[slot=tooltip-content]:text-background text-muted-foreground text-xs ring ring-input dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<kbd
			data-slot='kbd-group'
			className={cn('inline-flex items-center gap-1', className)}
			{...props}
		/>
	);
}

/** Returns a modifier character based on the client platform */
function KbdModifier() {
	const isApple = useIsAppleDevice();
	return isApple ? '⌘' : 'Ctrl';
}

export { Kbd, KbdGroup, KbdModifier };
