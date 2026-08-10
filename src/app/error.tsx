'use client';

import { Button } from '@/src/components/ui/button';

export default function RootError({
	retry: reset,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	return (
		<main className='flex min-h-screen flex-col items-center justify-center'>
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
