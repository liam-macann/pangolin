'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { motion, useReducedMotion } from 'motion/react';

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
	return <CollapsiblePrimitive.Root data-slot='collapsible' {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
	return <CollapsiblePrimitive.Trigger data-slot='collapsible-trigger' {...props} />;
}

function CollapsibleContent({
	children,
	...props
}: Omit<CollapsiblePrimitive.Panel.Props, 'render'>) {
	const reduceMotion = useReducedMotion();

	const transition = {
		type: 'spring',
		stiffness: 350,
		damping: 20,
		mass: 0.2,
	} as const;

	return (
		<CollapsiblePrimitive.Panel
			data-slot='collapsible-content'
			{...props}
			render={(_, state) => (
				<motion.div
					layout
					initial={false}
					animate={state.open ? 'open' : 'closed'}
					variants={{
						open: {
							height: 'auto',
							opacity: 1,
							...(reduceMotion ? {} : { filter: 'blur(0px)', scale: 1 }),
							overflow: 'visible',
						},
						closed: {
							height: 0,
							opacity: 0,
							...(reduceMotion ? {} : { filter: 'blur(1px)', scale: 0.98 }),
							overflow: 'clip',
						},
					}}
					transition={{ default: transition }}
				>
					{children}
				</motion.div>
			)}
		/>
	);
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
