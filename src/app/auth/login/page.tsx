import { CheckIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { providerMap, signIn } from '@/auth';
import LoginForm from '@/src/app/ui/login-form';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';

export const metadata: Metadata = {
	title: 'Login',
};

type ErrorDetails = {
	message: string;
	description?: string;
};

const errorDetails: Record<string, ErrorDetails> = {
	OAuthAccountNotLinked: {
		message: 'You already have an account',
		description: 'Sign in to connect this provider.',
	},
	AccountNotLinked: {
		message: 'You already have an account',
		description: 'Please sign in with the method you used to create your account.',
	},
	OAuthCallbackError: {
		message: 'The provider could not verify your identity',
	},
	OAuthSignInError: {
		message: 'The authorisation provider could not be reached',
	},
	EmailSignInError: {
		message: 'This token has expired',
		description: 'Please log in again.',
	},
	MissingCSRF: {
		message: 'Missing CSRF token',
		description:
			'Try disabling any script-blocking plugins and whitelisting cookies for this site.',
	},
	CredentialsSignin: {
		message: 'Invalid credentials',
	},
};

const paramsSchema = z.object({
	callbackUrl: z.url().catch('/dashboard'),
	error: z.enum(Object.keys(errorDetails)).catch('error').default(''),
});

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { callbackUrl, error } = paramsSchema.parse(await searchParams);

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
						<AlertTitle>{errorInfo.message}</AlertTitle>
						{errorInfo.description && <AlertDescription>{errorInfo.description}</AlertDescription>}
					</Alert>
				)}
				<div className='relative flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
					<h1 className={`-mt-2 mb-2 font-bold text-2xl`}>Login</h1>

					<section className='flex flex-col gap-2'>
						{Object.values(providerMap.filter(provider => provider.id !== 'credentials')).map(
							provider => (
								<form
									className='grow'
									key={provider.id}
									action={async () => {
										'use server';
										try {
											await signIn(provider.id, { redirectTo: callbackUrl });
										} catch (error) {
											if (error instanceof AuthError) {
												console.log(error.message);
												error.name;
												return redirect(`?error=${error.name}`);
											}

											// Remember that redirect is a thrown error internally
											throw error;
										}
									}}
								>
									<Button size='lg' type='submit' className='w-full'>
										<span>Sign in with {provider.name}</span>
									</Button>
								</form>
							),
						)}
					</section>
					{providerMap.find(provider => provider.id === 'credentials') && (
						<>
							<hr className='my-4' />
							<LoginForm callbackUrl={callbackUrl} />
						</>
					)}
				</div>
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
