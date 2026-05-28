import Link from 'next/link';
import { z } from 'zod';

import { Button } from '@/ui/button';

import { errorDetails } from './error-details';

const paramsSchema = z.object({
	error: z.enum(Object.keys(errorDetails)).catch('unknown_error'),
});

export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { error } = paramsSchema.parse(await searchParams);

	const errorInfo =
		error in errorDetails
			? errorDetails[error as keyof typeof errorDetails]
			: errorDetails.internal_server_error;

	return (
		<div className='flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
			<h5 className='mb-2 font-bold text-xl'>{errorInfo.heading || 'Something went wrong'}</h5>
			<div className=''>{errorInfo.message}</div>
			<div>
				<code className='rounded-sm bg-gray-3 p-1 text-xs'>{error}</code>
			</div>
			<Button
				className='mt-4 self-start'
				nativeButton={false}
				render={<Link href='/auth/login'>Retry</Link>}
			/>
		</div>
	);
}
