import { type ReactTable, type RowData } from '@tanstack/react-table';
import { type Context } from 'react';

import { type DataTableFeatures } from './features';

export type DataTableContext<TData extends RowData> = Context<ReactTable<
	DataTableFeatures,
	TData
> | null>;
