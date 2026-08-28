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
	const { mutate: setFavorite } = useClientMutation({
		targetId: client.id,
		scope: { id: 'favorite' },
		mutationFn: (status: boolean) => updateClientFavorite(client.id, status),
		onError: () => toast.error('Failed to update client. Please try again later.'),
		optimisticFn: (curr, status) => ({ ...curr, isFavorite: status }),
	});

	const archiveToastId = `archive-${client.id}`;
	const { mutate: setArchived } = useClientMutation({
		targetId: client.id,
		scope: { id: 'deleted' },
		mutationFn: (status: boolean) => {
			toast.loading({
				title: `${status ? 'Archiving' : 'Restoring'} client…`,
				id: archiveToastId,
				actionProps: undefined,
			});

			return updateClientDeleted(client.id, status);
		},
		onError: () =>
			toast.error({
				title: `Failed to archive ${client.data.name || client.data.organization}. Please try again later.`,
				id: archiveToastId,
			}),
		onSuccess: (_data, v) =>
			toast.success({
				title: `${client.data.name || client.data.organization} ${v ? 'archived' : 'restored'}`,
				id: archiveToastId,
				actionProps: v
					? {
							children: 'Undo',
							onClick: e => {
								e.preventDefault();
								setArchived(!v);
							},
						}
					: undefined,
			}),
		optimisticFn: (curr, status) => ({ ...curr, isDeleted: status }),
	});

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
