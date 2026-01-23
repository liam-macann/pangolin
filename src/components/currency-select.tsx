import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import type { Data as Currencies } from '@/api/currencies/route';
import {
	Combobox,
	ComboboxEmpty,
	ComboboxIcon,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxList,
	ComboboxPopup,
	ComboboxPositioner,
	ComboboxTrigger,
	ComboboxValue,
} from '@/components/ui/combobox';
import { useCurrencies } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type Currency = Currencies[number];

export function CurrencySelect({ disabled, ...props }: ComboboxPrimitive.Root.Props<Currency>) {
	const { data: currencies, isLoading, isError } = useCurrencies();

	if (isError) throw new Error('Failed to fetch currencies');

	return (
		<Combobox items={currencies} disabled={isLoading || !currencies || disabled} {...props}>
			<ComboboxTrigger
				className={cn(
					'min-w-60',
					isLoading && !disabled && 'disabled:cursor-progress disabled:opacity-100',
				)}
			>
				{currencies ? (
					<ComboboxValue>
						{(selectedValue: string) =>
							currencies.find(currency => currency.iso === selectedValue)?.name || selectedValue
						}
					</ComboboxValue>
				) : (
					<div className='h-[1em] w-28 animate-pulse rounded-sm bg-muted'>
						<span className='sr-only'>Loading…</span>
					</div>
				)}
				<ComboboxIcon>
					<CaretUpDownIcon />
				</ComboboxIcon>
			</ComboboxTrigger>
			<ComboboxPositioner align='start' sideOffset={4}>
				<ComboboxPopup className='w-70' aria-label='Select currency'>
					<div className='z-2 bg-popover p-1 pb-0 text-center'>
						<ComboboxInput className='inset-shadow-xs shadow-none' />
					</div>
					<ComboboxEmpty>No currency found.</ComboboxEmpty>
					<ComboboxList>
						{(currency: Currency) => (
							<ComboboxItem key={currency.iso} value={currency.iso}>
								<ComboboxItemIndicator />
								<div className='col-start-2 flex items-baseline justify-between'>
									<span className=''>{currency.name}</span>
									<span className='shrink-0 text-muted-foreground text-xs'>{currency.iso}</span>
								</div>
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxPopup>
			</ComboboxPositioner>
		</Combobox>
	);
}
