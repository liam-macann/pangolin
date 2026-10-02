import { type Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { getTimeZones, type TimeZone } from '@vvo/tzdb';
import { matchSorter } from 'match-sorter';

import { cn } from '@/lib/utils';

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

// Database stores IANA string: lookup necessary to convert to internal object
interface TimezoneSelectProps extends Omit<ComboboxPrimitive.Root.Props<TimeZone>, 'value'> {
	value?: string | null;
}

export function TimezoneSelectRoot({ value, ...props }: TimezoneSelectProps) {
	const val = timezones.find(tz => tz.name === (value || ''));

	return (
		<Combobox
			items={groups}
			value={val || null}
			isItemEqualToValue={(item, s) => item.name === s.name}
			itemToStringLabel={i => i.alternativeName}
			itemToStringValue={i => i.name}
			filter={fuzzyFilter}
			{...props}
		/>
	);
}

/** Input-in-popup variant of timezone combobox. Must be composed within TimezoneSelectRoot. */
export function TimezoneSelectCombobox({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
	return (
		<>
			<ComboboxTrigger className={cn('min-w-60', className)} {...props}>
				<ComboboxValue placeholder='Select time zone…' />
			</ComboboxTrigger>

			<TimezoneSelectContent>
				<ComboboxInput aria-label='Search time zones' showTrigger={false} />
			</TimezoneSelectContent>
		</>
	);
}

export function TimezoneSelectContent({
	children,
	...props
}: React.ComponentProps<typeof ComboboxContent>) {
	return (
		<ComboboxContent align='start' sideOffset={4} {...props}>
			{children}

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
	);
}

// Separate component to allow memoization
function Item({ tz }: { tz: TimeZone }) {
	const cities = getDisplayedCities(tz);
	const offset = formatUTC(tz);
	const accessibleName = `${tz.countryName}, ${offset}: ${cities.join(', ')}`;

	return (
		<ComboboxItem
			key={tz.name}
			value={tz}
			aria-label={accessibleName}
			className='items-baseline overflow-hidden pr-2'
		>
			<div className='flex w-full flex-col gap-0.5 overflow-hidden'>
				<span className='w-full items-baseline pr-6 font-medium'>
					{tz.countryName}
					<span className='ml-1.5 shrink-0 text-muted-foreground text-xs'>{offset}</span>
				</span>
				<div className='line-clamp-1 w-full truncate whitespace-pre text-muted-foreground text-xs'>
					{cities.map((city, i) => (
						<span key={city}>
							{city}
							{i < cities.length - 1 && ', '}
						</span>
					))}
				</div>
			</div>
		</ComboboxItem>
	);
}

function getDisplayedCities(tz: TimeZone) {
	return (
		tz.mainCities
			// Limit to 5 cities (more than needed), to reduce expense of following filter
			.slice(0, 5)
			// Some cities may match the country name, so filter them out to avoid redundant information
			.filter(city => city.localeCompare(tz.countryName))
			// Limit to 48 characters to avoid overflow
			.reduce<string[]>((cities, city) => {
				const next = `${cities.join(', ')}, ${city}`;
				if (next.length <= 48) cities.push(city);
				return cities;
			}, [])
	);
}

function formatUTC({ currentTimeOffsetInMinutes: m }: TimeZone) {
	const sign = m > 0 ? '+' : m < 0 ? '−' : '';

	const hours = Math.floor(Math.abs(m) / 60);
	const minutes = Math.abs(m) % 60;

	const offset = m ? `${hours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''}` : '';
	return `UTC${sign}${offset}`;
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
	.sort((a, b) => a[0].localeCompare(b[0], 'en'))
	.map(([continent, timezones]) => ({
		value: continent,
		items: timezones.sort((a, b) => a.countryName.localeCompare(b.countryName, 'en')),
	}));

function fuzzyFilter(item: TimeZone, query: string): boolean {
	if (!query) return true;

	const results = matchSorter([item], query, {
		keys: [
			{ key: 'mainCities', threshold: matchSorter.rankings.WORD_STARTS_WITH },
			{ key: 'countryName', threshold: matchSorter.rankings.WORD_STARTS_WITH },
			{ key: 'alternativeName', threshold: matchSorter.rankings.WORD_STARTS_WITH },
			{ key: 'abbreviation', threshold: matchSorter.rankings.STARTS_WITH },
		],
	});

	return results.length > 0;
}
