'use client';

import type { ComponentProps } from 'react';
import { signIn } from '@/lib/auth';
import { Button } from '@/ui/button';

export function LoginButton({
	callbackURL,
	...props
}: { callbackURL: string } & ComponentProps<typeof Button>) {
	return (
		<Button
			className='grow'
			onClick={async () => {
				await signIn.social({
					provider: 'google',
					callbackURL,
					newUserCallbackURL: '/onboarding',
					errorCallbackURL: '/auth/login',
				});
			}}
			size='lg'
			{...props}
		/>
	);
}
