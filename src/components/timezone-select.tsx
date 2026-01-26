import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { getTimeZones, type TimeZone } from '@vvo/tzdb';

import {
	Combobox,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
} from '@/ui/combobox';

export function TimezoneSelect({
	locale,
	...props
}: {
	locale: string;
} & ComboboxPrimitive.Root.Props<TimeZone>) {
	return (
		<Combobox items={groups} {...props}>
			<ComboboxTrigger className='min-w-60'>
				<ComboboxValue>
					{(selectedValue: string) =>
						timezones.find(tz => tz.name === selectedValue)?.alternativeName || selectedValue
					}
				</ComboboxValue>
			</ComboboxTrigger>
			<ComboboxContent align='start' sideOffset={4}>
				<ComboboxInput showTrigger={false} />
				<ComboboxEmpty>No time zone found.</ComboboxEmpty>
				<ComboboxList>
					{(group: GroupItem) => (
						<ComboboxGroup key={group.value} items={group.items}>
							<ComboboxLabel>{group.value}</ComboboxLabel>
							<ComboboxCollection>
								{(tz: TimeZone) => <Item key={tz.name} tz={tz} />}
							</ComboboxCollection>
						</ComboboxGroup>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

// Separate component to allow memoization
function Item({ tz }: { tz: TimeZone }) {
	return (
		<ComboboxItem key={tz.name} value={tz.name} className='items-baseline pr-2'>
			<div className='flex w-full flex-col gap-0.5 overflow-hidden'>
				<div className='flex items-baseline gap-1 pr-6 font-medium'>
					<span>{tz.alternativeName}</span>
					<span className='shrink-0 text-muted-foreground text-xs'>
						{(() => {
							const m = tz.currentTimeOffsetInMinutes;
							const sign = m > 0 ? '+' : m < 0 ? '−' : '';
							const hours = Math.abs(m) / 60 || '';
							return (
								<>
									UTC<span className='mx-[0.25px]'>{sign}</span>
									{hours}
								</>
							);
						})()}
					</span>
				</div>
				<span className='line-clamp-1 w-full truncate whitespace-pre text-muted-foreground text-xs'>
					{tz.countryName} –{' '}
					{tz.mainCities.slice(0, 4).map((city, i, arr) => (
						<span key={city}>
							{city}
							{i < arr.length - 1 && (
								<>
									, <wbr />
								</>
							)}
						</span>
					))}
				</span>
			</div>
		</ComboboxItem>
	);
}

interface GroupItem {
	value: string;
	items: TimeZone[];
}

// This is client-side, and does not reconcile with DB supported timezones
const timezones = getTimeZones();

const continents = timezones.reduce((acc, tz) => {
	const continent = tz.continentName;
	acc.set(continent, [...(acc.get(continent) || []), tz]);
	return acc;
}, new Map<string, TimeZone[]>());

const groups = [...continents]
	.sort((a, b) => a[0].localeCompare(b[0]))
	.map(([continent, timezones]) => ({
		value: continent,
		items: timezones.sort((a, b) => a.countryName.localeCompare(b.countryName)),
	}));
