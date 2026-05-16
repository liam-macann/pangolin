'use client';

import { type ComponentProps, type JSX } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

import { type Data as Client } from '@/api/clients/[id]/route';
import { updateClientDeleted, updateClientFavorite } from '@/lib/actions/client';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

/** Mutate client array and individual client simultaneously */
function useMutateClient(clientId: string) {
	const { mutate } = useSWRConfig();

	type Data = Client | Promise<Client> | undefined;
	type Opts = { optimisticData?: Client };

	/** Maps the entire client list, replacing the mutated client with the resolved data */
	const replace = (curr: Client[] | undefined, resolved: Client | undefined) =>
		curr?.map(item => (item.id === clientId ? (resolved ?? item) : item)) ?? [];

	const fn = (data?: Data, opts?: Opts) => {
		mutate<Client>(`/api/clients/${clientId}`, data, opts);
		mutate<Client[]>(
			'/api/clients',
			curr => (data instanceof Promise ? data.then(r => replace(curr, r)) : replace(curr, data)),
			{ ...opts, optimisticData: curr => replace(curr, opts?.optimisticData) },
		);
	};

	return { mutate: fn };
}

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
					<DropdownMenuItem variant='destructive' onClick={() => setArchived(!client.isDeleted)}>
						{client.isDeleted ? 'Restore' : 'Archive'}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
