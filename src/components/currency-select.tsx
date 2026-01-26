import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import type { Data as Currencies } from '@/api/currencies/route';
import { useCurrencies } from '@/lib/hooks';
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
			</ComboboxTrigger>
			<ComboboxContent align='start' sideOffset={4}>
				<ComboboxInput showTrigger={false} />
				<ComboboxEmpty>No currency found.</ComboboxEmpty>
				<ComboboxList>
					{(currency: Currency) => (
						<ComboboxItem key={currency.iso} value={currency.iso}>
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
