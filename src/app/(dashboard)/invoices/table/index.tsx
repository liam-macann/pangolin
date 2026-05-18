'use no memo';
'use client';

import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import { toMerged } from 'es-toolkit';
import { type ComponentProps, createContext } from 'react';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { cn, type ElementType } from '@/lib/utils';

import { createDataTable } from '@/components/data-table';

import { columns } from './columns';

export const LocaleContext = createContext<string>('en-AU');
export const DEFAULT_SORT: SortingState = [{ id: 'reference', desc: true }];

type Invoice = ElementType<InvoiceData>;

/** Component factory that returns preconfigured defaults for Invoice data. Useful if omitting columns from the exported definition. */
export function createInvoiceTable<TValue>(cols: ColumnDef<Invoice, TValue>[] = columns) {
	const FactoryDataTable = createDataTable(cols);

	const Root = ({
		data,
		locale,
		initialState = {},
		...props
	}: ComponentProps<typeof FactoryDataTable.Root> & { locale: string }) => (
		<LocaleContext value={locale}>
			<FactoryDataTable.Root
				data={data.map(invoice => ({
					...invoice,
					...('grossTotal' in invoice ? { grossTotal: Number(invoice.grossTotal) } : {}),
				}))}
				enableSortingRemoval={false}
				initialState={toMerged({ sorting: DEFAULT_SORT }, initialState)}
				{...props}
			/>
		</LocaleContext>
	);

	const Content = (props: ComponentProps<typeof FactoryDataTable.Content>) => (
		<FactoryDataTable.Content
			getRowAttr={row => ({
				'data-void': row.status.isVoid || undefined,
				style: row.status.isVoid
					? {
							background: `repeating-linear-gradient(
                               45deg,
                               transparent,
                               transparent 2px,
                               color-mix(var(--color-gray-3) 50%, transparent) 2px,
                               color-mix(var(--color-gray-3) 50%, transparent) 4px
                          )`,
							backgroundSize: 'calc(4px * sqrt(2))',
						}
					: undefined,
				className: 'data-void:text-foreground/50 group/row align-baseline',
			})}
			getCellAttr={() => ({ className: cn('align-baseline') })}
			{...props}
		/>
	);

	const Search = (props: ComponentProps<typeof FactoryDataTable.Search>) => (
		<FactoryDataTable.Search placeholder='Search invoices…' {...props} />
	);

	return { ...FactoryDataTable, Root, Content, Search };
}

export const DataTable = createInvoiceTable(columns);
export default DataTable;

export { columns } from './columns';
