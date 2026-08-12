import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { type ReactTable, type RowData } from '@tanstack/react-table';
import { type ComponentProps, type KeyboardEvent, useContext } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';

import { type DataTableFeatures } from './features';
import { type DataTableContext } from './types';

type DataTableSearchProps<TData extends RowData> = Omit<
	ComponentProps<typeof InputGroup>,
	'onKeyDown'
> & {
	onKeyDown?: (
		event: KeyboardEvent<HTMLInputElement>,
		table: ReactTable<DataTableFeatures, TData>,
	) => void;
} & Pick<ComponentProps<typeof InputGroupInput>, 'placeholder' | 'value'>;

export function createDataTableSearch<TData extends RowData>(
	TableContext: DataTableContext<TData>,
) {
	return function Search({
		onChange,
		placeholder,
		children,
		value,
		onKeyDown,
		...props
	}: DataTableSearchProps<TData>) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Search must be used within a DataTable.Root');

		return (
			<InputGroup {...props}>
				<InputGroupAddon>
					<MagnifyingGlassIcon />
				</InputGroupAddon>
				<InputGroupInput
					aria-label='Search'
					placeholder={placeholder ?? 'Search…'}
					value={value ?? table.state.globalFilter}
					onChange={event => {
						onChange?.(event);
						table.setGlobalFilter(event.target.value);
					}}
					onKeyDown={event => onKeyDown?.(event, table)}
				/>
				{children}
			</InputGroup>
		);
	};
}
