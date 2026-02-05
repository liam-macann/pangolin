import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import currencies from '@/lib/data/currencies.json';
import { cn } from '@/lib/utils';
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
interface CurrencySelectProps extends Omit<ComboboxPrimitive.Root.Props<Currency>, 'value'> {
	value?: string | null;
}

type Currency = (typeof currencies)[number];

export function CurrencySelect({ value, ...props }: CurrencySelectProps) {
	const val = currencies.find(i => i.iso === (value || ''));

	return (
		<Combobox
			items={currencies}
			value={val || null}
			{...props}
			isItemEqualToValue={(item, s) => item.iso === s.iso}
			itemToStringLabel={v => v.name}
			itemToStringValue={v => v.iso}
		>
			<ComboboxTrigger className={'min-w-60'}>
				<ComboboxValue />
			</ComboboxTrigger>
			<ComboboxContent align='start' sideOffset={4}>
				<ComboboxInput showTrigger={false} />
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
		</Combobox>
	);
}
