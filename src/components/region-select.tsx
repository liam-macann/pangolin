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
interface RegionSelectRootProps extends Omit<ComboboxPrimitive.Root.Props<ICountryData>, 'value'> {
	value?: string | null | undefined;
}

/** Wrapped RegionSelect, in both inline and popup variants  */
export function RegionSelect({
	popup = true,
	...props
}: RegionSelectRootProps & {
	popup?: boolean;
	className?: string;
}) {
	return (
		<RegionSelectRoot {...props}>
			{popup ? (
				<ComboboxTrigger className={cn('min-w-60')}>
					<ComboboxValue />
				</ComboboxTrigger>
			) : (
				<RegionSelectInput />
			)}

			<RegionSelectContent>
				{popup && <RegionSelectInput autoComplete='country-name' showTrigger={false} />}
			</RegionSelectContent>
		</RegionSelectRoot>
	);
}

export const RegionSelectInput = (props: React.ComponentProps<typeof ComboboxInput>) => (
	<ComboboxInput autoComplete='country-name' {...props} />
);

export function RegionSelectRoot({ children, value, ...props }: RegionSelectRootProps) {
	const val = regions.get(value || '');

	return (
		<Combobox
			items={regionArr}
			value={val || null}
			{...props}
			isItemEqualToValue={(item, s) => item.iso2 === s.iso2}
			itemToStringLabel={v => v.name}
			itemToStringValue={v => v.iso2}
		>
			{children}
		</Combobox>
	);
}

export function RegionSelectContent({
	children,
	...props
}: React.ComponentProps<typeof ComboboxContent>) {
	return (
		<ComboboxContent align='start' sideOffset={4} {...props}>
			{children}

			<ComboboxEmpty>No region found.</ComboboxEmpty>
			<ComboboxList>
				{(country: ICountryData) => (
					<ComboboxItem key={country.iso2} value={country}>
						{country.name}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);
}
