'use client';

import { QueryClientProvider } from '@tanstack/react-query';

import { useSession } from '@/lib/auth';
import { useIsomorphicLayoutEffect, usePrevious } from '@/lib/hooks';

import { getQueryClient } from './client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const client = getQueryClient();

	const { data: session } = useSession();
	const userId = session?.user.id ?? null;
	const previous = usePrevious(userId);

	useIsomorphicLayoutEffect(() => {
		if (previous !== null && previous !== userId) client.clear();
	}, [client, previous, userId]);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
