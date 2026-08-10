'use client';

import { Button } from '@/src/components/ui/button';

export default function RouteError({
	retry: reset,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	return (
		<main className='flex flex-col items-center justify-center'>
			<h2 className='mb-4 text-center'>Something went wrong</h2>
			<Button
				onClick={
					// Re-render the invoices route
					() => reset()
				}
			>
				Try again
			</Button>
		</main>
	);
}
