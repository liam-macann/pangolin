import Link from 'next/link';
import { Button } from '@/ui/button';

export default function Page() {
	return (
		<div className='flex h-screen items-center justify-center'>
			<Button asChild>
				<Link href='/auth/login'>Login</Link>
			</Button>
		</div>
	);
}
