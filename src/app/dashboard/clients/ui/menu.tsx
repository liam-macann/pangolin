'use client';

import { type ComponentProps, type JSX } from 'react';
import { toast } from 'sonner';

import { type Data as ClientData } from '@/api/clients/route';
import { updateClientDeleted, updateClientFavorite } from '@/lib/actions/client';
import { useClient, useClients } from '@/lib/hooks';
import { type ElementType } from '@/lib/utils';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

type Client = ElementType<ClientData>;

export function useClientActions(client: Client) {
	const { mutate: mutateClients } = useClients();
	const { mutate: mutateClient } = useClient(client.id, client);
	const id = client.id;

	/** Mutates SWR hooks with optimistic updates */
	const mutate = (promise: Promise<unknown>, mutation: Client) => {
		const map = (curr: Client[] | undefined) =>
			curr ? curr.map(item => (item.id === id ? mutation : item)) : [];

		mutateClients(async curr => promise.then(() => map(curr)), {
			optimisticData: curr => map(curr),
		});

		mutateClient(async () => promise.then(() => mutation), { optimisticData: mutation });
	};

	const setFavorite = (v: boolean) => {
		const mutation = { ...client, isFavorite: v };

		const promise = updateClientFavorite(id, v).catch(err => {
			toast.error('Failed to update client. Please try again later.');
			throw err;
		});

		mutate(promise, mutation);
	};

	const setArchived = (v: boolean) => {
		const mutation = { ...client, isDeleted: v };

		const toastId = `archive-${client.id}`;
		toast.loading(`${v ? 'Archiving' : 'Restoring'} client…`, { id: toastId, action: undefined });

		const promise = updateClientDeleted(id, v)
			.then(() =>
				toast.success(`${client.data.name} ${v ? 'archived' : 'restored'}`, {
					id: toastId,
					action: v
						? {
								label: 'Undo',
								onClick: e => {
									e.preventDefault();
									setArchived(!v);
								},
							}
						: undefined,
				}),
			)
			.catch(err => {
				toast.error('Failed to archive client. Please try again later.', { id: toastId });
				throw err;
			});

		mutate(promise, mutation);
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
					<DropdownMenuItem variant='destructive' onClick={() => setArchived(!client.isDeleted)}>
						{client.isDeleted ? 'Restore' : 'Archive'}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
