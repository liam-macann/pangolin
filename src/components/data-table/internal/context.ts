import { createTableHookContexts } from '@tanstack/react-table';

import { type DataTableFeatures } from '@/components/data-table/internal/features';

export const {
	tableContext,
	cellContext,
	headerContext,
	useTableContext: useInternalTableContext,
} = createTableHookContexts<DataTableFeatures>();
