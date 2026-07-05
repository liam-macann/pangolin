'use client';

import { ArrowUpRightIcon } from '@phosphor-icons/react';
import { unstable_rethrow } from 'next/navigation';
import { type ComponentProps, useState } from 'react';
import { toast } from 'sonner';

import { signIn } from '@/lib/auth';

import { Button } from '@/ui/button';
import { Spinner } from '@/ui/spinner';

export function LoginButton({
	callbackURL,
	children,
	...props
}: { callbackURL: string } & Omit<ComponentProps<typeof Button>, 'loading'>) {
	const [loading, setLoading] = useState(false);

	return (
		<Button
			className='grow'
			loading={loading}
			onClick={async () => {
				if (loading) return;
				setLoading(true);

				await signIn
					.social({
						provider: 'google',
						callbackURL,
						newUserCallbackURL: '/onboarding',
						errorCallbackURL: '/auth/login',
					})
					.then(res => {
						if (res.error) throw new Error(res.error.message);
					})
					.catch(err => {
						unstable_rethrow(err);
						setLoading(false);
						toast.error('Something went wrong');
						return err;
					});
			}}
			size='lg'
			{...props}
		>
			Login{' '}
			{!loading ? (
				<ArrowUpRightIcon data-icon='inline-end' />
			) : (
				<Spinner className='translate-x-0.5' data-icon='inline-end' />
			)}
		</Button>
	);
}
