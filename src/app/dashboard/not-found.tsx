'use client';

import { Button } from '@/components/ui/button';

export default function Page() {
	return (
		<div className='flex flex-col items-center justify-center py-12'>
			<div>
				<h1 className='mb-2 font-bold text-3xl'>404</h1>
				<p>This page could not be found.</p>
				<Button onClick={() => history.back()} className='mt-8'>
					Go back
				</Button>
			</div>
		</div>
	);
}
