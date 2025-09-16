import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { providerMap, signIn } from '@/auth';
import LoginForm from '@/src/app/ui/login-form';
import { Button } from '@/ui/button';

export const metadata: Metadata = {
	title: 'Login',
};

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { callbackUrl, error } = await searchParams;
	const normalizedUrl =
		typeof callbackUrl === 'string' ? callbackUrl : (callbackUrl?.join('') ?? '/dashboard');

	return (
		<main className='flex min-h-screen items-center justify-center bg-gray-2'>
			<div className='md:-mt-32 relative mx-auto flex w-full max-w-[400px] flex-col gap-y-4 rounded-md border bg-card p-8 shadow'>
				<h1 className={`mb-2 font-bold text-2xl`}>Login</h1>

				<section className='flex gap-2'>
					{Object.values(providerMap).map(provider => (
						<form
							className='grow'
							key={provider.id}
							action={async () => {
								'use server';
								try {
									await signIn(provider.id, { redirectTo: normalizedUrl });
								} catch (error) {
									if (error instanceof AuthError) return redirect(`?error=${error.type}`);

									// Remember that redirect is a thrown error internally
									throw error;
								}
							}}
						>
							<Button type='submit' className='w-full'>
								<span>Sign in with {provider.name}</span>
							</Button>
						</form>
					))}
				</section>
				<hr className='my-4' />

				<LoginForm callbackUrl={normalizedUrl} />
			</div>
		</main>
	);
}
