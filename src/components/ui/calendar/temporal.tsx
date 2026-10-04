'use client';

import { isPlainObject, mapValues } from 'es-toolkit';
import type * as React from 'react';
import { type DateLib, type DayPickerProps } from 'react-day-picker';
import { Temporal } from 'temporal-polyfill';
import { type KeysOfUnion } from 'type-fest';

import { toTemporal } from '@/lib/utils/date';

import { Calendar as BaseCalendar, CalendarDayButton } from './legacy';

const PROPS = [
	'selected',
	'onSelect',
	'today',
	'disabled',
	'hidden',
	'modifiers',
	'formatters',
	'labels',
	'onNextClick',
	'onPrevClick',
	'defaultMonth',
	'month',
	'startMonth',
	'endMonth',
	'onMonthChange',
	'onDayClick',
	'onDayFocus',
	'onDayBlur',
	'onDayKeyDown',
	'onDayMouseEnter',
	'onDayMouseLeave',
] as const satisfies readonly KeysOfUnion<DayPickerProps>[];

// biome-ignore format: Nested conditions easier to read when flat
type SwapDate<T> = T extends Date ? Temporal.PlainDate
	: T extends React.SyntheticEvent ? T
	: T extends DateLib ? T
	: T extends (...args: infer Args) => infer R ? (...args: SwapDate<Args>) => R
	: T extends object ? { [K in keyof T]: SwapDate<T[K]> }
	: T;

type DateProps = React.ComponentProps<typeof BaseCalendar>;

// Uses generic to distribute over union type
type TemporalProps<Props = DateProps> = Props extends unknown
	? { [Key in keyof Props]: Key extends (typeof PROPS)[number] ? SwapDate<Props[Key]> : Props[Key] }
	: never;

const target = new Set<PropertyKey>(PROPS);

function convertTemporal(props: TemporalProps): DateProps;
function convertTemporal({ timeZone, ...props }: TemporalProps): unknown {
	const swap = (value: unknown): unknown => {
		if (value instanceof Temporal.PlainDate) {
			return toTemporal.encode(
				value.toZonedDateTime({ timeZone, plainTime: { hour: 12 } }).toInstant(),
			);
		}

		if (value instanceof Date) {
			return toTemporal.decode(value).toZonedDateTimeISO(timeZone).toPlainDate();
		}

		if (typeof value === 'function') return (...args: unknown[]) => value(...args.map(swap));
		if (Array.isArray(value)) return value.map(swap);
		if (isPlainObject(value)) return mapValues(value, swap);

		return value;
	};

	return {
		...mapValues(props, (value, key) => (target.has(key) ? swap(value) : value)),
		timeZone,
	};
}

export const Calendar = (props: TemporalProps) => (
	<BaseCalendar noonSafe {...convertTemporal(props)} />
);

export { CalendarDayButton };
