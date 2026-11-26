import { MotionGlobalConfig } from 'motion/react';
import { FormProvider, useForm } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { InvoiceOptions } from './options';
import { type CreateInvoiceDraft } from './schema';

/** Provides the form context that the options read from, with a draft due on 30 Jun 2026. */
function Options({ timezone }: { timezone: string }) {
	const form = useForm<CreateInvoiceDraft>({
		defaultValues: { dueAt: Temporal.PlainDate.from('2026-06-30') },
	});

	return (
		<FormProvider {...form}>
			<InvoiceOptions timezone={timezone} locale='en-US' />
		</FormProvider>
	);
}

/** Renders the options and locates their controls. */
async function renderOptions(timezone: string) {
	const screen = await render(<Options timezone={timezone} />);

	return {
		dueDate: screen.getByRole('button', { name: 'Due date' }),
		notes: screen.getByRole('button', { name: 'Notes' }),
		tooltip: (text: string) => screen.getByText(text, { exact: true }),
		day: (name: string) => screen.getByRole('button', { name }),
		notesField: screen.getByRole('textbox', { name: 'Your private notes' }),
	};
}

beforeEach(() => (MotionGlobalConfig.skipAnimations = true));
afterEach(() => (MotionGlobalConfig.skipAnimations = false));

describe('Dates', () => {
	// 16 Jun in Kiritimati;
	// 15 Jun in UTC;
	// 14 Jun in Pago Pago
	const now = Temporal.Instant.from('2026-06-15T10:30:00Z');

	afterEach(() => vi.restoreAllMocks());
	beforeEach(() => {
		vi.spyOn(Temporal.Now, 'plainDateISO').mockImplementation((zone = 'UTC') =>
			now.toZonedDateTimeISO(zone).toPlainDate(),
		);
	});

	test('Shows the due date of the draft in the tooltip', async () => {
		const { dueDate, tooltip } = await renderOptions('Pacific/Kiritimati');
		await dueDate.hover();

		await expect.element(tooltip('Due Jun 30')).toBeVisible();
	});

	test('Updates the due date when a different day is selected', async () => {
		const { dueDate, day, tooltip } = await renderOptions('Pacific/Kiritimati');
		await dueDate.click();
		await day('June 17th').click();
		await dueDate.hover();

		await expect.element(tooltip('Due Jun 17')).toBeVisible();
	});

	test('Only allows due dates after today in the config timezone', async () => {
		const { dueDate, day } = await renderOptions('Pacific/Kiritimati');
		await dueDate.click();

		await expect.element(day('June 10th')).toBeDisabled();
		await expect.element(day('June 16th')).toBeDisabled();
		await expect.element(day('June 17th')).toBeEnabled();
		await expect.element(day('June 20th')).toBeEnabled();
	});
});

describe('Notes', () => {
	test('Labels the button by whether notes exist', async () => {
		const { notes, notesField, tooltip } = await renderOptions('UTC');
		await notes.hover();
		await expect.element(tooltip('Add notes')).toBeVisible();

		await notes.click();
		await notesField.fill('Net 30');
		await notes.unhover();
		await notes.hover();
		await expect.element(tooltip('Edit notes')).toBeVisible();
	});
});
