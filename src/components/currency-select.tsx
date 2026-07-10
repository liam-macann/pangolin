import { type Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { matchSorter } from 'match-sorter';

import { cn } from '@/lib/utils';
import { currencies } from '@/lib/utils/currencies';

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
} from '@/ui/combobox';

// Database stores ISO string: lookup necessary to convert to internal object
interface CurrencySelectProps
	extends Omit<
		ComboboxPrimitive.Root.Props<Currency>,
		'items' | 'value' | 'isItemEqualToValue' | 'itemToStringLabel' | 'itemToStringValue'
	> {
	value?: string | null;
}

type Currency = (typeof currencies)[number];

export function CurrencySelectRoot({ value, ...props }: CurrencySelectProps) {
	const val = currencies.find(i => i.iso === (value || ''));

	return (
		<Combobox
			items={currencies}
			value={val || null}
			isItemEqualToValue={(item, s) => item.iso === s.iso}
			itemToStringLabel={v => v.name}
			itemToStringValue={v => v.iso}
			filter={fuzzyFilter}
			{...props}
		/>
	);
}

/** Input-in-popup variant of currency combobox. Must be composed within CurrencySelectRoot. */
export function CurrencySelectCombobox({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
	return (
		<>
			<ComboboxTrigger className={cn('min-w-60', className)} {...props}>
				<ComboboxValue placeholder='Select currency…' />
			</ComboboxTrigger>

			<CurrencySelectContent>
				<ComboboxInput showTrigger={false} />
			</CurrencySelectContent>
		</>
	);
}

export function CurrencySelectContent({
	children,
	...props
}: React.ComponentProps<typeof ComboboxContent>) {
	return (
		<ComboboxContent align='start' sideOffset={4} {...props}>
			{children}

			<ComboboxEmpty>No currency found.</ComboboxEmpty>
			<ComboboxList>
				{(currency: Currency) => (
					<ComboboxItem key={currency.iso} value={currency}>
						<div className='flex w-full items-baseline justify-between'>
							<span className=''>{currency.name}</span>
							<span className='shrink-0 text-muted-foreground text-xs'>{currency.iso}</span>
						</div>
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);
}

function fuzzyFilter(item: Currency, query: string): boolean {
	if (!query) return true;

	const results = matchSorter([item], query, {
		keys: [
			{ key: 'iso', threshold: matchSorter.rankings.STARTS_WITH },
			{ key: 'name', threshold: matchSorter.rankings.CONTAINS },
		],
	});

	return results.length > 0;
}
