'use client';

import { signIn } from '@/lib/auth';
import { Button } from '@/ui/button';

export function Social({ callbackURL }: { callbackURL: string }) {
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
		>
			Sign in with Google
		</Button>
	);
}
