import { CheckIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react/ssr';
import { type Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';

import { getSession } from '@/auth';
import { type ErrorCodes, errorDetails } from '@/src/app/auth/error/error-details';

import { LoginButton } from './ui';

export const metadata: Metadata = {
	title: 'Login',
};

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { callbackUrl, error } = z
		.object({
			callbackUrl: z.url().catch('/invoices'),
			error: z
				.enum(Object.keys(errorDetails) as ErrorCodes[])
				.catch('internal_server_error')
				.optional(),
		})
		.parse(await searchParams);

	const session = await getSession();
	if (session?.user.id) redirect(callbackUrl);

	const errorInfo = error && errorDetails[error];

	return (
		<div>
			<section className='space-y-4'>
				{errorInfo && (
					<Alert variant='destructive'>
						<WarningCircleIcon className='text-destructive' />
						{errorInfo.heading && <AlertTitle>{errorInfo.heading}</AlertTitle>}
						<AlertDescription>{errorInfo.message}</AlertDescription>
					</Alert>
				)}

				<LoginButton variant='primary' callbackURL={callbackUrl} />
			</section>
			<section className='mt-12'>
				<h2 className='mb-2 font-semibold text-lg'>What this is</h2>
				<p className='mb-6 text-muted-foreground'>
					This is not accounting software, or a CRM. Basic invoice templating, for low-volume
					service providers.
				</p>

				<ul className='space-y-2'>
					{[
						'Dead-simple invoice generator',
						'Designed for sole traders',
						'A place to understand your income',
					].map(el => (
						<li className='flex items-baseline gap-3' key={el}>
							<div className='flex size-5 shrink-0 items-center justify-center rounded-full bg-green-4 text-green-12'>
								<CheckIcon size={12} />
							</div>
							{el}
						</li>
					))}
				</ul>

				<h2 className='mt-8 mb-4 font-semibold text-lg'>What we won't do</h2>

				<ul className='space-y-2'>
					{[
						'Receive and track payment',
						'Handle your tax or audit responsibilities',
						'Keep inventory',
					].map(el => (
						<li className='flex items-baseline gap-3' key={el}>
							<div className='flex size-5 shrink-0 items-center justify-center rounded-full bg-red-4 text-red-12'>
								<XIcon size={12} />
							</div>
							{el}
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
