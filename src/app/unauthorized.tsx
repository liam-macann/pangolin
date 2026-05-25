import Link from 'next/link';

import { Button } from '@/src/components/ui/button';

export default function UnauthorizedPage() {
	return (
		<main className='flex h-full flex-col items-center justify-center'>
			<h2 className='mb-4 text-center'>You are not signed in</h2>
			<Button nativeButton={false} render={<Link href='/auth/login' />}>
				Log in
			</Button>
		</main>
	);
}
