'use client';

import {
	ArrowRightIcon,
	EnvelopeSimpleIcon,
	PasswordIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { authenticate } from '@/src/app/lib/actions';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';

export default function LoginForm() {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
	const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

	return (
		<form action={formAction} className='space-y-3'>
			<div className='flex flex-1 flex-col gap-4 rounded-md border border-border bg-gray-1 p-6'>
				<h1 className={`mb-2 text-2xl`}>Please log in to continue.</h1>
				{errorMessage && (
					<div className='mb-2 flex items-center space-x-1' aria-live='polite' aria-atomic='true'>
						<WarningCircleIcon className='size-4 text-destructive' />
						<p className='font-medium text-destructive text-sm'>{errorMessage}</p>
					</div>
				)}
				<div className=''>
					<Label className='mb-2' htmlFor='email'>
						Email
					</Label>
					<div className='relative'>
						<Input
							className='pl-10'
							id='email'
							type='email'
							name='email'
							placeholder='Email address'
							required
						/>
						<EnvelopeSimpleIcon className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] text-gray-11 peer-focus:text-gray-12' />
					</div>
				</div>
				<div>
					<Label className='mb-2' htmlFor='password'>
						Password
					</Label>
					<div className='relative'>
						<Input
							className='pl-10'
							id='password'
							type='password'
							name='password'
							placeholder='Enter password'
							required
							minLength={6}
						/>
						<PasswordIcon className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] text-gray-11 peer-focus:text-gray-12' />
					</div>
				</div>
				<input type='hidden' name='redirectTo' value={callbackUrl} />
				<Button
					variant='outline'
					className='mt-4 w-full'
					aria-disabled={isPending}
					disabled={isPending}
					type='submit'
				>
					Log in <ArrowRightIcon className='size-4' />
				</Button>
			</div>
		</form>
	);
}
