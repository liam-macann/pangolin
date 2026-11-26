import { cn } from '@/lib/utils';

import { SpinnerIcon } from '@/icons';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return (
		<SpinnerIcon
			role='status'
			aria-label='Loading'
			className={cn('size-4 animate-spin select-none opacity-80', className)}
			{...props}
		/>
	);
}

export { Spinner };
