'use client';

import { ArrowUpRightIcon } from '@phosphor-icons/react';
import { type ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/ui/button';
import { Spinner } from '@/ui/spinner';

export function LoginButton({
	action,
	...props
}: { action: () => void } & ComponentProps<typeof Button>) {
	return (
		<form action={action}>
			<SubmitButton {...props} />
		</form>
	);
}

export function SubmitButton(props: Omit<ComponentProps<typeof Button>, 'loading' | 'children'>) {
	const { pending } = useFormStatus();

	return (
		<Button className='grow' type='submit' loading={pending} size='lg' {...props}>
			Login{' '}
			{!pending ? <ArrowUpRightIcon data-icon='inline-end' /> : <Spinner data-icon='inline-end' />}
		</Button>
	);
}
