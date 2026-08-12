'use client';

import { type ColumnDef, type ReactTable, type RowData } from '@tanstack/react-table';
import { createContext } from 'react';

import { createDataTableContent } from './content';
import { type DataTableFeatures } from './features';
import { createDataTablePaginationControls } from './pagination-controls';
import { createDataTableRoot } from './root';
import { createDataTableSearch } from './search';

export type { DataTableFeatures } from './features';

/** Component factory, to create a typed data table */
export function createDataTable<TData extends RowData>(
	columns: ColumnDef<DataTableFeatures, TData>[],
) {
	const TableContext = createContext<ReactTable<DataTableFeatures, TData> | null>(null);

	return {
		Root: createDataTableRoot(columns, TableContext),
		Content: createDataTableContent(columns, TableContext),
		PaginationControls: createDataTablePaginationControls(TableContext),
		Search: createDataTableSearch(TableContext),
		Context: TableContext,
	};
}
