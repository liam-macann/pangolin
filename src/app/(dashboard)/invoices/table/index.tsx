'use client';

import { type TableState } from '@tanstack/react-table';
import { toMerged } from 'es-toolkit';

import { type Config } from '@/api/dto/config';
import { type Invoice } from '@/api/dto/invoice';
import { cn } from '@/lib/utils';

import {
	type DataTableBodyProps,
	type DataTableFeatures,
	type DataTableOptions,
	useDataTable,
} from '@/components/data-table';

import { columns } from './columns';
import { usePlaceholderInvoices } from './placeholder';
import { DEFAULT_SORT } from './sort';

export type UseInvoiceTableOptions = Omit<DataTableOptions<Invoice>, 'columns'> & {
	columns?: DataTableOptions<Invoice>['columns'];
};

/** Creates a table instance with preconfigured defaults for Invoice data. */
export function useInvoiceTable<TSelected = TableState<DataTableFeatures>>(
	{
		data,
		columns: invoiceColumns = columns,
		initialState = {},
		...options
	}: UseInvoiceTableOptions,
	selector?: (state: TableState<DataTableFeatures>) => TSelected,
) {
	return useDataTable(
		{
			data,
			columns: invoiceColumns,
			getRowId: invoice => invoice.id,
			enableSortingRemoval: false,
			initialState: toMerged(
				{ sorting: DEFAULT_SORT, columnVisibility: { clientId: false } },
				initialState,
			),
			...options,
		},
		selector,
	);
}

type InvoiceTable = ReturnType<typeof useInvoiceTable>;

export function InvoiceTableContent({
	table,
	getRowAttr,
	getCellAttr,
	...props
}: DataTableBodyProps<Invoice> & { table: Pick<InvoiceTable, 'Content'> }) {
	return (
		<table.Content
			getRowAttr={(row, ...args) => {
				const overrides = getRowAttr?.(row, ...args);
				return {
					'data-void': row.isVoid || undefined,
					...overrides,

					className: cn(
						'group/row align-baseline data-void:text-foreground/50',
						overrides?.className,
					),

					style: {
						backgroundImage: row.isVoid
							? `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 2px,
                    color-mix(var(--color-gray-3) 50%, transparent) 2px,
                    color-mix(var(--color-gray-3) 50%, transparent) 4px
                )`
							: '',
						backgroundSize: row.isVoid ? 'calc(4px * sqrt(2))' : '',

						...overrides?.style,
					},
				};
			}}
			getCellAttr={(...args) => {
				const overrides = getCellAttr?.(...args);
				return { ...overrides, className: cn('align-baseline', overrides?.className) };
			}}
			{...props}
		/>
	);
}

export function PlaceholderTable({ config, count }: { config: Config; count?: number }) {
	const data = usePlaceholderInvoices(config, count);
	const table = useInvoiceTable({ data }, () => null);

	return (
		<table.AppTable>
			<InvoiceTableContent
				table={table}
				inert
				className='pointer-events-none border-separate border-spacing-0 select-none opacity-40'
				getRowAttr={(_, i) => ({
					style: {
						scale: (0.98 ** i).toFixed(2),
						opacity: (0.8 ** i).toFixed(2),
						translate: `0 -${1.1 ** i - 1}rem`,
						// filter: `blur(${1.06 ** i - 1}px)`,
					},
				})}
			/>
		</table.AppTable>
	);
}

export { columns } from './columns';
export { DEFAULT_SORT, fromAPISort, toAPISort } from './sort';
