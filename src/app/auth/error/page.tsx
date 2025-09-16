import Link from 'next/link';
import { z } from 'zod';
import { Button } from '@/components/ui/button';

type ErrorDetails = {
	heading?: React.ReactNode;
	message: React.ReactNode;
};

const errorDetails: Record<string, ErrorDetails> = {
	Configuration: {
		message: (
			<>
				There was a problem when trying to authenticate. Please contact us if this error persists.
				Unique error code: <code className='rounded-sm bg-gray-3 p-1 text-xs'>Configuration</code>
			</>
		),
	},
	// Usually occurs, when you restricted access through the signIn callback, or redirect callback.
	AccessDenied: {
		message: (
			<>
				There was a problem when trying to authenticate. Please contact us if this error persists.
				Unique error code: <code className='rounded-sm bg-gray-3 p-1 text-xs'>AccessDenied</code>
			</>
		),
	},
	// Related to the Email provider. The token has expired or has already been used.
	Verification: {
		heading: 'Invalid link',
		message: <>This token has expired or has already been used. Please try again.</>,
	},
	Default: {
		message:
			'There was a problem when trying to authenticate. Please contact us if this error persists.',
	},
};

const paramsSchema = z.object({
	error: z.enum(Object.keys(errorDetails)).catch('Default'),
});

export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { error } = paramsSchema.parse(await searchParams);

	const errorInfo =
		error in errorDetails ? errorDetails[error as keyof typeof errorDetails] : errorDetails.Default;

	return (
		<div className='flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
			<h5 className='mb-2 font-bold text-xl'>{errorInfo.heading || 'Something went wrong'}</h5>
			<div className=''>{errorInfo.message}</div>
			<Button className='mt-4 self-start' asChild>
				<Link href='/auth/login'>Retry</Link>
			</Button>
		</div>
	);
}
