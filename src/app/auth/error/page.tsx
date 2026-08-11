import Link from 'next/link';
import { Suspense } from 'react';
import { z } from 'zod';

import { Button } from '@/ui/button';

import { errorDetails } from './error-details';

const paramsSchema = z.object({
	error: z
		.enum([...(Object.keys(errorDetails) as Array<keyof typeof errorDetails>), 'unknown_error'])
		.catch('unknown_error'),
});

type ErrorCode = z.infer<typeof paramsSchema>['error'];

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function AuthErrorPage({ searchParams }: { searchParams: SearchParams }) {
	return (
		<div className='flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
			<Suspense fallback={<ErrorMessage />}>
				{searchParams.then(params => {
					const { error } = paramsSchema.parse(params);
					return <ErrorMessage error={error} />;
				})}
			</Suspense>

			<div className='mt-4 flex items-end justify-between'>
				<Button
					variant='primary'
					nativeButton={false}
					render={<Link href='/auth/login'>Retry</Link>}
				/>
				<Suspense fallback={null}>
					<ErrorCode searchParams={searchParams} />
				</Suspense>
			</div>
		</div>
	);
}

function ErrorMessage({ error = 'unknown_error' }: { error?: ErrorCode }) {
	const errorInfo =
		error in errorDetails
			? errorDetails[error as keyof typeof errorDetails]
			: errorDetails.internal_server_error;

	return (
		<>
			<h5 className='mb-2 font-bold text-xl'>{errorInfo.heading || 'Something went wrong'}</h5>
			<div className=''>{errorInfo.message}</div>
		</>
	);
}

async function ErrorCode({ searchParams }: { searchParams: SearchParams }) {
	const { error } = paramsSchema.parse(await searchParams);
	return <code className='text-muted-foreground text-xs'>{error}</code>;
}
