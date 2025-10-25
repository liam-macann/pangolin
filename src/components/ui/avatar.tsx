import { UserIcon } from '@phosphor-icons/react/ssr';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { md5 } from 'hash-wasm';
import type * as React from 'react';
import { cn } from '@/lib/utils';

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
	return (
		<AvatarPrimitive.Root
			data-slot='avatar'
			className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
	return (
		<AvatarPrimitive.Image
			data-slot='avatar-image'
			className={cn('aspect-square size-full', className)}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot='avatar-fallback'
			className={cn('flex size-full items-center justify-center rounded-full bg-muted', className)}
			{...props}
		/>
	);
}

import Placeholder from 'boring-avatars';

export default function GeneratedAvatar({
	email,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { email: string }) {
	return (
		<Avatar {...props}>
			<Gravatar email={email} />
			<AvatarFallback>
				<Placeholder
					className='size-full'
					name={email}
					colors={['#f8dac2', '#f2a297', '#f4436f', '#ca1444', '#142738']}
					variant='marble'
				/>
			</AvatarFallback>
		</Avatar>
	);
}

async function Gravatar({ email }: { email: string }) {
	return (
		<AvatarImage
			src={`https://seccdn.libravatar.org/avatar/${await md5(email.trim().toLowerCase())}?d=404`}
		/>
	);
}

export function AvatarEmpty({ ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
	return (
		<Avatar {...props}>
			<AvatarFallback>
				<UserIcon />
			</AvatarFallback>
		</Avatar>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
