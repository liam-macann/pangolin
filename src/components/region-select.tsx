import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { getCountryDataList, type ICountryData } from 'countries-list';
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

const regionArr = getCountryDataList().toSorted((a, b) => a.name.localeCompare(b.name));
export const regions: Map<string, ICountryData> = new Map(regionArr.map(r => [r.iso2, r]));

// Database stores ISO string: lookup necessary to convert to internal object
interface RegionSelectProps extends Omit<ComboboxPrimitive.Root.Props<ICountryData>, 'value'> {
	value?: string | null | undefined;
	popup?: boolean;
}

/** Button version of region combobox, with filter input inside popup  */
export function RegionSelect({ popup = true, value, ...props }: RegionSelectProps) {
	const val = regions.get(value || '');

	return (
		<Combobox
			items={regionArr}
			value={val}
			{...props}
			isItemEqualToValue={(item, s) => item.iso2 === s.iso2}
			itemToStringLabel={v => v.name}
			itemToStringValue={v => v.iso2}
		>
			{popup ? (
				<ComboboxTrigger className={cn('min-w-60')}>
					<ComboboxValue />
				</ComboboxTrigger>
			) : (
				<ComboboxInput />
			)}

			<ComboboxContent align='start' sideOffset={4}>
				{popup && <ComboboxInput showTrigger={false} />}

				<ComboboxEmpty>No region found.</ComboboxEmpty>
				<ComboboxList>
					{(country: ICountryData) => (
						<ComboboxItem key={country.iso2} value={country}>
							{country.name}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
