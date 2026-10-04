import { type ComponentProps } from 'react';
import { DateLib } from 'react-day-picker';
import { Temporal } from 'temporal-polyfill';
import { type DistributedOmit } from 'type-fest';
import { assert, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { Calendar } from './index';
import { type Calendar as BaseCalendar } from './legacy';

type BaseCalendarProps = ComponentProps<typeof BaseCalendar>;

const capture = vi.hoisted(() => vi.fn<(props: BaseCalendarProps) => void>());

beforeEach(() => vi.clearAllMocks());

vi.mock('./legacy', () => ({
	CalendarDayButton: () => null,
	Calendar: (props: BaseCalendarProps) => {
		capture(props);
		return null;
	},
}));

/** Renders the Temporal adapter and returns the props passed to the base calendar. */
async function renderAdapter(
	props: DistributedOmit<ComponentProps<typeof Calendar>, 'timeZone'>,
	// Honolulu is non-UTC timezone without DST
	timeZone = 'Pacific/Honolulu',
) {
	await render(<Calendar timeZone={timeZone} {...props} />);
	const call = capture.mock.lastCall?.[0];
	assert(call, 'Expected the adapter to render the base calendar');
	return call;
}

const temporal = (day: number) => Temporal.PlainDate.from({ year: 2026, month: 1, day });
const date = (day: number) => new Date(Date.UTC(2026, 0, day, 22)); // Noon in Pacific/Honolulu

const dateLib = new DateLib();

describe('Temporal calendar adapter', () => {
	test('Converts top-level date props', async () => {
		const props = await renderAdapter({
			today: temporal(10),
			defaultMonth: temporal(11),
			month: temporal(12),
			startMonth: temporal(13),
			endMonth: temporal(14),
		});

		expect(props).toMatchObject({
			today: date(10),
			defaultMonth: date(11),
			month: date(12),
			startMonth: date(13),
			endMonth: date(14),
		});
	});

	test.for([
		['Pacific/Pago_Pago', '2026-01-01'],
		['Pacific/Kiritimati', '2026-01-01'],
		['America/Santiago', '2026-09-06'],
	] as const)('Adapts dates to local noon in %s', async ([timeZone, iso]) => {
		const selected = Temporal.PlainDate.from(iso);
		const props = await renderAdapter({ mode: 'single', selected }, timeZone);

		const epoch = selected.toZonedDateTime({ timeZone, plainTime: { hour: 12 } }).epochMilliseconds;
		expect(props).toMatchObject({ selected: new Date(epoch) });
	});

	test('Converts dates passed to formatters', async () => {
		const props = await renderAdapter({
			formatters: {
				formatDay: (day, _options, lib) => {
					expectTypeOf(day).toEqualTypeOf<Temporal.PlainDate>();
					expectTypeOf(lib).toEqualTypeOf<DateLib | undefined>();

					expect(day).toEqual(temporal(10));
					expect(lib).toBe(dateLib);
					return String(day.day);
				},
			},
		});

		assert(props.formatters?.formatDay, 'Expected the formatter to be forwarded');
		expect(props.formatters.formatDay(date(10), undefined, dateLib)).toBe('10');
	});

	test('Converts dates passed to labels', async () => {
		const props = await renderAdapter({
			labels: {
				labelDayButton: (day, _modifiers, _options, lib) => {
					expectTypeOf(day).toEqualTypeOf<Temporal.PlainDate>();
					expectTypeOf(lib).toEqualTypeOf<DateLib | undefined>();

					expect(day).toEqual(temporal(10));
					expect(lib).toBe(dateLib);
					return String(day.day);
				},
			},
		});

		assert(props.labels?.labelDayButton, 'Expected the label to be forwarded');
		expect(props.labels.labelDayButton(date(10), {}, undefined, dateLib)).toBe('10');
	});

	describe('Selection modes', () => {
		test('Converts single selection mode', async () => {
			const props = await renderAdapter({
				mode: 'single',
				selected: temporal(10),
				onSelect: s => expectTypeOf(s).toEqualTypeOf<Temporal.PlainDate | undefined>(),
			});
			expect(props).toMatchObject({ selected: date(10) });
		});

		test('Converts multiple selection mode', async () => {
			const props = await renderAdapter({
				mode: 'multiple',
				selected: [temporal(10), temporal(11)],
				onSelect: s => expectTypeOf(s).toEqualTypeOf<Temporal.PlainDate[] | undefined>(),
			});

			expect(props).toMatchObject({ selected: [date(10), date(11)] });
		});

		test('Converts range selection mode', async () => {
			const props = await renderAdapter({
				mode: 'range',
				selected: { from: temporal(10), to: temporal(11) },
				onSelect: s =>
					expectTypeOf(s).toEqualTypeOf<
						| { from: Temporal.PlainDate | undefined; to?: Temporal.PlainDate | undefined }
						| undefined
					>(),
			});

			expect(props).toMatchObject({ selected: { from: date(10), to: date(11) } });
		});
	});

	describe('Matchers', () => {
		test('Converts dates nested in matcher props', async () => {
			const props = await renderAdapter({
				disabled: [temporal(10), [temporal(11)]],
				hidden: { from: temporal(12), to: temporal(13) },
				modifiers: { payday: [temporal(14), { after: temporal(15) }] },
			});

			expect(props).toMatchObject({
				disabled: [date(10), [date(11)]],
				hidden: { from: date(12), to: date(13) },
				modifiers: { payday: [date(14), { after: date(15) }] },
			});
		});

		test('Converts dates passed to function matchers', async () => {
			const isTenth = vi.fn((date: Temporal.PlainDate) => date.day === 10);

			const props = await renderAdapter({ disabled: isTenth });
			assert(typeof props.disabled === 'function', 'Expected a function matcher');

			expect(props.disabled(date(10))).toBe(true);
			expect(isTenth).toHaveBeenCalledWith(temporal(10));
		});
	});

	describe('Callbacks', () => {
		// biome-ignore lint/suspicious/noExplicitAny: Used for testing opaque event handling
		const anyEvent = {} as any;

		test.for(['onMonthChange', 'onNextClick', 'onPrevClick'] as const)(
			'Converts the month passed to %s',
			async prop => {
				const callback = vi.fn();
				const props = await renderAdapter({ [prop]: callback });

				props[prop]?.(date(10));

				expect(callback).toHaveBeenCalledWith(temporal(10));
			},
		);

		test.for([
			'onDayClick',
			'onDayFocus',
			'onDayBlur',
			'onDayKeyDown',
			'onDayMouseEnter',
			'onDayMouseLeave',
		] as const)('Converts the day passed to %s', async prop => {
			const callback = vi.fn();
			const modifiers = { selected: true };
			const props = await renderAdapter({ [prop]: callback });

			props[prop]?.(date(10), modifiers, anyEvent);

			expect(callback).toHaveBeenCalledWith(temporal(10), modifiers, anyEvent);
		});

		test('Converts range selection callback values', async () => {
			const onSelect = vi.fn();
			const modifiers = { range_start: true };

			const props = await renderAdapter({ mode: 'range', onSelect });
			assert(props.mode === 'range' && props.onSelect, 'Expected a range selection handler');
			props.onSelect({ from: date(10), to: date(11) }, date(11), modifiers, anyEvent);

			expect(onSelect).toHaveBeenCalledWith(
				{ from: temporal(10), to: temporal(11) },
				temporal(11),
				modifiers,
				anyEvent,
			);
		});
	});
});
