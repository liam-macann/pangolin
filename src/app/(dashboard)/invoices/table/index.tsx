'use client';

import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import { toMerged } from 'es-toolkit';
import { type ComponentProps, createContext, useContext } from 'react';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { type fetchConfig } from '@/lib/data';
import { cn, type ElementType } from '@/lib/utils';

import { createDataTable, type DataTableFeatures } from '@/components/data-table';

import { columns } from './columns';
import { usePlaceholderInvoices } from './placeholder-data';

export const LocaleContext = createContext<string>('en-AU');
export const DEFAULT_SORT: SortingState = [{ id: 'reference', desc: true }];

type Invoice = ElementType<InvoiceData>;

/** Component factory that returns preconfigured defaults for Invoice data. Useful if omitting columns from the exported definition. */
export function createInvoiceTable(cols: ColumnDef<DataTableFeatures, Invoice>[] = columns) {
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
				initialState={toMerged(
					{ sorting: DEFAULT_SORT, columnVisibility: { clientId: false } },
					initialState,
				)}
				{...props}
			/>
		</LocaleContext>
	);

	const Content = ({
		getRowAttr,
		getCellAttr,
		...props
	}: ComponentProps<typeof FactoryDataTable.Content>) => (
		<FactoryDataTable.Content
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

	const Search = (props: ComponentProps<typeof FactoryDataTable.Search>) => {
		const table = useContext(FactoryDataTable.Context);
		if (!table) throw new Error('Search must be used within a DataTable.Root');

		const clientFilter = table.state.columnFilters.find(f => f.id === 'clientId');
		const clientId = clientFilter ? String(clientFilter.value) : null;

		const clientName = clientId
			? (table.getCoreRowModel().rows.find(r => r.original.clientData.clientId === clientId)
					?.original.clientData.name ?? clientId)
			: null;

		return (
			<FactoryDataTable.Search
				value={clientName ?? undefined}
				placeholder='Search invoices…'
				{...props}
			/>
		);
	};

	return { ...FactoryDataTable, Root, Content, Search };
}

export const DataTable = createInvoiceTable(columns);
export default DataTable;

type Config = Awaited<ReturnType<typeof fetchConfig>>;

export function PlaceholderTable({ config, count }: { config: Config; count?: number }) {
	const data = usePlaceholderInvoices(config, count);
	return (
		<DataTable.Root data={data} locale={config.locale}>
			<DataTable.Content
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
		</DataTable.Root>
	);
}

export const InvoiceTableRoot = DataTable.Root;
export const InvoiceTableContent = DataTable.Content;

export { columns } from './columns';
