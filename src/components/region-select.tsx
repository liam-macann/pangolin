import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import type { ICountryData } from 'countries-list';
import { getCountryDataList } from 'countries-list';
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

const regions = getCountryDataList().toSorted((a, b) => a.name.localeCompare(b.name));

export function RegionSelect(props: ComboboxPrimitive.Root.Props<string>) {
	return (
		<Combobox items={regions} {...props}>
			<ComboboxTrigger className={cn('min-w-60')}>
				<ComboboxValue>
					{(selectedValue: string) =>
						regions.find(country => country.iso2 === selectedValue)?.name || selectedValue
					}
				</ComboboxValue>
			</ComboboxTrigger>
			<ComboboxContent align='start' sideOffset={4}>
				<ComboboxInput showTrigger={false} />
				<ComboboxEmpty>No region found.</ComboboxEmpty>
				<ComboboxList>
					{(country: ICountryData) => (
						<ComboboxItem key={country.iso2} value={country.iso2}>
							<div>{country.name}</div>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
