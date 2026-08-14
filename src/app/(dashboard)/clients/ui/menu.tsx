'use client';

import Link from 'next/link';
import { type ComponentProps, type JSX } from 'react';

import { updateClientDeleted, updateClientFavorite } from '@/lib/actions/client';
import { type Client } from '@/lib/data/client';
import { useMutateClient } from '@/lib/hooks';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { toast } from '@/ui/toast';

export function useClientActions(client: Client) {
	const { mutate } = useMutateClient(client.id);
	const id = client.id;

	const setFavorite = (v: boolean) => {
		const mutation = { ...client, isFavorite: v };

		const promise = updateClientFavorite(id, v).catch(err => {
			toast.error('Failed to update client. Please try again later.');
			throw err;
		});

		mutate(
			promise.then(() => mutation),
			{ optimisticData: mutation },
		);
	};

	const setArchived = (v: boolean) => {
		const mutation = { ...client, isDeleted: v };

		const toastId = `archive-${client.id}`;
		toast.loading({
			title: `${v ? 'Archiving' : 'Restoring'} client…`,
			id: toastId,
			actionProps: undefined,
		});

		const promise = updateClientDeleted(id, v)
			.then(() =>
				toast.success({
					title: `${client.data.name} ${v ? 'archived' : 'restored'}`,
					id: toastId,
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
			)
			.catch(err => {
				toast.error({ title: 'Failed to archive client. Please try again later.', id: toastId });
				throw err;
			});

		mutate(
			promise.then(() => mutation),
			{ optimisticData: mutation },
		);
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
