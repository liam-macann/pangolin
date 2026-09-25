import { createTableHookContexts } from '@tanstack/react-table';

import { type DataTableFeatures } from './features';

export const {
	tableContext,
	cellContext,
	headerContext,
	useTableContext: useInternalTableContext,
} = createTableHookContexts<DataTableFeatures>();
