'use client';

import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/ui/button';
import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
} from '@/ui/dropdown-menu';

export function FeedbackSubmenu({ name, email }: { name: string; email: string }) {
	const [value, setValue] = useState('');

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>Feedback</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				keepMounted
				className='flex flex-col gap-1'
				render={
					<form
						onSubmit={e => {
							e.preventDefault();

							if (!value) {
								toast.error('Please enter a message');
								return;
							}

							Sentry.captureFeedback({
								name: name,
								email: email,
								message: value,
							});

							toast.success('Thank you for sharing your thoughts');

							setValue('');
						}}
					/>
				}
			>
				<DropdownMenuSubContentTextarea
					value={value}
					onChange={e => setValue(e.currentTarget.value)}
					name='feedback'
					label='Tell us what you think'
					onKeyDown={e => {
						console.log(e.currentTarget.form);
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							e.currentTarget.form?.requestSubmit();
						}
					}}
				/>

				<Button variant='primary' size='sm' type='submit' disabled={!value}>
					Submit
				</Button>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
