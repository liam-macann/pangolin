import type { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
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
				<ComboboxValue />
			</ComboboxTrigger>

			<TimezoneSelectContent>
				<ComboboxInput showTrigger={false} />
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
	return (
		<ComboboxItem key={tz.name} value={tz} className='items-baseline pr-2'>
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
	.sort((a, b) => a[0].localeCompare(b[0], 'en'))
	.map(([continent, timezones]) => ({
		value: continent,
		items: timezones.sort((a, b) => a.countryName.localeCompare(b.countryName, 'en')),
	}));

function fuzzyFilter(item: TimeZone, query: string): boolean {
	if (!query) return true;

	const results = matchSorter([item], query, {
		keys: [
			'mainCities',
			'countryName',
			'alternativeName',
			'abbreviation',
			{ key: 'mainCities', threshold: matchSorter.rankings.WORD_STARTS_WITH },
			{ key: 'countryName', threshold: matchSorter.rankings.CONTAINS },
			{ key: 'alternativeName', threshold: matchSorter.rankings.WORD_STARTS_WITH },
			{ key: 'abbreviation', threshold: matchSorter.rankings.ACRONYM },
		],
	});

	return results.length > 0;
}
