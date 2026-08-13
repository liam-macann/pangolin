'use client';

import { type ColumnDef, type SortingState, type TableState } from '@tanstack/react-table';
import { toMerged } from 'es-toolkit';
import { createContext, useMemo } from 'react';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { type fetchConfig } from '@/lib/data';
import { cn, type ElementType } from '@/lib/utils';

import {
	type DataTableContentProps,
	type DataTableFeatures,
	type DataTableOptions,
	useDataTable,
} from '@/components/data-table';

import { columns } from './columns';
import { usePlaceholderInvoices } from './placeholder-data';

export const LocaleContext = createContext<string>('en-AU');
export const DEFAULT_SORT: SortingState = [{ id: 'reference', desc: true }];

type Invoice = ElementType<InvoiceData>;

export type UseInvoiceTableOptions = Omit<DataTableOptions<Invoice>, 'columns'> & {
	columns?: ColumnDef<DataTableFeatures, Invoice>[];
};

/** Creates a table instance with preconfigured defaults for Invoice data */
export function useInvoiceTable<TSelected = TableState<DataTableFeatures>>(
	{
		data,
		columns: invoiceColumns = columns,
		initialState = {},
		...options
	}: UseInvoiceTableOptions,
	selector?: (state: TableState<DataTableFeatures>) => TSelected,
) {
	const tableData = useMemo(
		() =>
			data.map(invoice => ({
				...invoice,
				...('grossTotal' in invoice ? { grossTotal: Number(invoice.grossTotal) } : {}),
			})),
		[data],
	);

	return useDataTable(
		{
			data: tableData,
			columns: invoiceColumns,
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
}: DataTableContentProps<Invoice> & { table: Pick<InvoiceTable, 'Content'> }) {
	return (
		<table.Content
			getRowAttr={(row, ...args) => {
				const overrides = getRowAttr?.(row, ...args);
				return {
					'data-void': row.status.isVoid || undefined,
					...overrides,

					className: cn(
						'group/row align-baseline data-void:text-foreground/50',
						overrides?.className,
					),

					style: {
						backgroundImage: row.status.isVoid
							? `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 2px,
                    color-mix(var(--color-gray-3) 50%, transparent) 2px,
                    color-mix(var(--color-gray-3) 50%, transparent) 4px
                )`
							: '',
						backgroundSize: row.status.isVoid ? 'calc(4px * sqrt(2))' : '',

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

type Config = Awaited<ReturnType<typeof fetchConfig>>;

export function PlaceholderTable({ config, count }: { config: Config; count?: number }) {
	const data = usePlaceholderInvoices(config, count);
	const table = useInvoiceTable({ data }, () => null);

	return (
		<LocaleContext value={config.locale}>
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
		</LocaleContext>
	);
}

export { columns } from './columns';
