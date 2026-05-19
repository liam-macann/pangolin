import { cn } from '@/lib/utils';

export function StatCard({
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
				'flex flex-col gap-1 rounded-md border bg-card p-6 py-4 font-medium text-xl',
				className,
			)}
		>
			{title && <p className='flex text-muted-foreground text-sm'>{title}</p>}
			<div className='flex grow flex-col justify-center text-xl'>{children}</div>
			{footer && <p className='flex text-muted-foreground text-sm'>{footer}</p>}
		</div>
	);
}
