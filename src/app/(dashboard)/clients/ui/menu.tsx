'use client';

import Link from 'next/link';
import { type ComponentProps, type JSX } from 'react';

import { type Client } from '@/api/dto/client';
import { updateClientDeleted, updateClientFavorite } from '@/lib/actions/client';
import { useClientMutation } from '@/lib/hooks';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { toast } from '@/ui/toast';

export function useClientActions(client: Client) {
	const { mutateAsync: setFavorite } = useClientMutation(client.id, {
		mutationFn: (status: boolean) => updateClientFavorite(client.id, status),
		onError: () => toast.error('Failed to update client. Please try again later.'),
	});

	const { mutateAsync: updateDeleted } = useClientMutation(client.id, {
		mutationFn: (status: boolean) => updateClientDeleted(client.id, status),
	});

	const setArchived = async (v: boolean) => {
		const toastId = `archive-${client.id}`;
		toast.loading({
			title: `${v ? 'Archiving' : 'Restoring'} client…`,
			id: toastId,
			actionProps: undefined,
		});

		try {
			await updateDeleted(v);
			toast.success({
				title: `${client.data.name} ${v ? 'archived' : 'restored'}`,
				id: toastId,
				actionProps: v
					? {
							children: 'Undo',
							onClick: e => {
								e.preventDefault();
								void setArchived(!v);
							},
						}
					: undefined,
			});
		} catch {
			toast.error({ title: 'Failed to archive client. Please try again later.', id: toastId });
		}
	};

	return { setFavorite, setArchived };
}

export function OverflowMenu({
	client,
	children,
	render,
	...props
}: { client: Client; children?: JSX.Element } & ComponentProps<typeof DropdownMenuContent> &
	Pick<ComponentProps<typeof DropdownMenuTrigger>, 'render'>) {
	const { setArchived } = useClientActions(client);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={render} />
			<DropdownMenuContent {...props}>
				<DropdownMenuGroup>
					{children}
					<DropdownMenuItem render={<Link href={`/invoices?client=${client.id}`} />}>
						View invoices
					</DropdownMenuItem>
					<DropdownMenuItem variant='destructive' onClick={() => setArchived(!client.isDeleted)}>
						{client.isDeleted ? 'Restore' : 'Archive'}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
