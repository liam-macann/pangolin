import { CheckIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react/ssr';
import { type Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';

import { signInSocial } from '@/auth';

import { errorDetails } from './../error/page';
import { LoginButton } from './ui';

export const metadata: Metadata = {
	title: 'Login',
};

const paramsSchema = z.object({
	callbackUrl: z.url().catch('/invoices'),
	error: z.enum(Object.keys(errorDetails)).catch('error').default(''),
});

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { callbackUrl, error } = paramsSchema.parse(await searchParams);

	async function login() {
		'use server';

		const response = await signInSocial({
			headers: await headers(),
			body: {
				provider: 'google',
				callbackURL: callbackUrl,
				newUserCallbackURL: '/onboarding',
				errorCallbackURL: '/auth/login',
			},
		});

		if (response?.url) redirect(response.url);
	}

	const errorInfo =
		error &&
		(error in errorDetails
			? errorDetails[error as keyof typeof errorDetails]
			: { message: 'Something went wrong. Please try again later.' });

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

				<LoginButton variant='primary' action={login} />
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
