import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';

import { TimezoneSelectCombobox, TimezoneSelectRoot } from './timezone-select';

async function openAndSearch(screen: RenderResult, query: string) {
	await screen.getByRole('combobox', { name: 'Select time zone' }).click();
	await screen.getByRole('combobox', { name: 'Search time zones' }).fill(query);
}

describe('TimezoneSelect', () => {
	test('Displays the current time zone', async () => {
		const screen = await render(
			<TimezoneSelectRoot value='Asia/Kolkata'>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await expect
			.element(screen.getByRole('combobox', { name: 'Select time zone' }))
			.toHaveTextContent('India Time');
	});

	test('Provides accessible label for the popup search field', async () => {
		const screen = await render(
			<TimezoneSelectRoot>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await screen.getByRole('combobox', { name: 'Select time zone' }).click();

		await expect.element(screen.getByRole('combobox', { name: 'Search time zones' })).toBeVisible();
	});

	test.for<[string, string, RegExp]>([
		['country', 'India', /^India, UTC/],
		['city', 'Kathmandu', /^Nepal, UTC/],
		['alternative name', 'India Time', /^India, UTC/],
		['abbreviation', 'IST', /^India, UTC/],
	])('Filters by %s', async ([, query, optionName]) => {
		const screen = await render(
			<TimezoneSelectRoot>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await openAndSearch(screen, query);

		await expect.element(screen.getByRole('option', { name: optionName })).toBeVisible();
	});

	test('Returns the selected IANA time zone', async () => {
		const onValueChange = vi.fn();
		const screen = await render(
			<TimezoneSelectRoot onValueChange={onValueChange}>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await openAndSearch(screen, 'Kathmandu');
		await expect.element(screen.getByRole('option')).toHaveAccessibleName(/^Nepal, UTC/);

		await userEvent.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Asia/Kathmandu' }),
			expect.anything(),
		);
	});

	test('Displays an empty state when no time zone matches', async () => {
		const screen = await render(
			<TimezoneSelectRoot>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await openAndSearch(screen, 'Not a real time zone');

		await expect.element(screen.getByText('No time zone found.')).toBeVisible();
	});

	test.for<[string, string, RegExp]>([
		['zero', 'Iceland', /^Iceland, UTC: Reykjavík/],
		['positive whole-hour', 'Japan', /^Japan, UTC\+9: Tokyo/],
		['negative whole-hour', 'Colombia', /^Colombia, UTC−5: Bogotá/],
		['positive half-hour', 'India', /^India, UTC\+5:30: Mumbai/],
		['positive quarter-hour', 'Nepal', /^Nepal, UTC\+5:45: Kathmandu/],
		['negative half-hour', 'Marquesas', /^French Polynesia, UTC−9:30: Marquesas/],
	])('Displays %s offsets', async ([, query, optionName]) => {
		const screen = await render(
			<TimezoneSelectRoot>
				<TimezoneSelectCombobox aria-label='Select time zone' />
			</TimezoneSelectRoot>,
		);

		await openAndSearch(screen, query);

		await expect.element(screen.getByRole('option', { name: optionName })).toBeVisible();
	});
});
