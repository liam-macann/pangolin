import { WarningCircleIcon } from '@phosphor-icons/react/ssr';
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
		<>
			{errorInfo && (
				<Alert variant='destructive'>
					<WarningCircleIcon className='text-destructive' />
					<AlertTitle>{errorInfo.message}</AlertTitle>
					{errorInfo.description && <AlertDescription>{errorInfo.description}</AlertDescription>}
				</Alert>
			)}
			<div className='relative flex flex-col gap-y-4 rounded-md border bg-card p-4 py-8 shadow md:p-8'>
				<h1 className={`-mt-2 mb-2 font-bold text-2xl`}>Login</h1>

				<section className='flex gap-2 max-md:flex-col'>
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
								<Button type='submit' className='w-full'>
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
		</>
	);
}
