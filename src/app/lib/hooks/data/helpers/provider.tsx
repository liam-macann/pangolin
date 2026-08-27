'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '@/lib/auth';
import { useIsomorphicLayoutEffect, usePrevious } from '@/lib/hooks';

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(() => new QueryClient());

	const { data: session } = useSession();
	const userId = session?.user.id ?? null;
	const previous = usePrevious(userId);

	useIsomorphicLayoutEffect(() => {
		if (previous !== null && previous !== userId) client.clear();
	}, [client, previous, userId]);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
