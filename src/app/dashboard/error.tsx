'use client';

import { useEffect } from 'react';

import { Button } from '@/src/components/ui/button';

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Optionally log the error to an error reporting service
		console.error(error);
	}, [error]);

	return (
		<main className='flex h-full flex-col items-center justify-center'>
			<h2 className='mb-4 text-center'>Something went wrong!</h2>
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
