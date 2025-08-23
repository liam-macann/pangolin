import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from '@/src/app/ui/login-form';

export const metadata: Metadata = {
	title: 'Login',
};

export default function LoginPage() {
	return (
		<main className='flex items-center justify-center md:h-screen'>
			<div className='md:-mt-32 relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4'>
				<Suspense>
					<LoginForm />
				</Suspense>
			</div>
		</main>
	);
}
