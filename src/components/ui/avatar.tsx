import { UserIcon } from '@phosphor-icons/react/ssr';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
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

export default function UserAvatar({
	image,
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { image: string | null }) {
	return (
		<Avatar className={cn('!bg-gray-4', className)} {...props}>
			{image && <AvatarImage src={`/api/avatar?user=${image}`} />}
			<AvatarFallback>
				<UserIcon className='size-1/2' />
			</AvatarFallback>
		</Avatar>
	);
}

export function AvatarEmpty({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
	return (
		<Avatar className={cn('!bg-gray-4 size-full', className)} {...props}>
			<AvatarFallback>
				<UserIcon className='size-1/2' />
			</AvatarFallback>
		</Avatar>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
