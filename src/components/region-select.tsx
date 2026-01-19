import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';

import type { ICountryData } from 'countries-list';
import { getCountryDataList } from 'countries-list';

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
import { cn } from '@/lib/utils';

export function RegionSelect(props: React.ComponentProps<typeof Combobox>) {
	const regions = getCountryDataList().toSorted((a, b) => a.name.localeCompare(b.name));

	return (
		<Combobox items={regions} {...props}>
			<ComboboxTrigger className={cn('min-w-60')}>
				<ComboboxValue>
					{(selectedValue: string) =>
						regions.find(country => country.iso2 === selectedValue)?.name || selectedValue
					}
				</ComboboxValue>
				<ComboboxIcon>
					<CaretUpDownIcon />
				</ComboboxIcon>
			</ComboboxTrigger>
			<ComboboxPositioner align='start' sideOffset={4}>
				<ComboboxPopup className='w-70' aria-label='Select currency'>
					<div className='z-2 bg-popover p-1 pb-0 text-center'>
						<ComboboxInput className='inset-shadow-xs shadow-none' />
					</div>
					<ComboboxEmpty>No region found.</ComboboxEmpty>
					<ComboboxList>
						{(country: ICountryData) => (
							<ComboboxItem className='gap-3 pr-5' key={country.iso2} value={country.iso2}>
								<ComboboxItemIndicator />
								<div className='col-start-2'>{country.name}</div>
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxPopup>
			</ComboboxPositioner>
		</Combobox>
	);
}
