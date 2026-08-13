import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { type ComponentProps, type KeyboardEvent } from 'react';

import { useInternalTableContext } from '@/components/data-table/internal/context';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';

export type DataTableSearchProps = Omit<ComponentProps<typeof InputGroup>, 'onKeyDown'> & {
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
} & Pick<ComponentProps<typeof InputGroupInput>, 'placeholder' | 'value'>;

export function DataTableSearch({
	onChange,
	placeholder,
	children,
	value,
	onKeyDown,
	...props
}: DataTableSearchProps) {
	const table = useInternalTableContext();

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
				onKeyDown={onKeyDown}
			/>
			{children}
		</InputGroup>
	);
}
