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

/** Renders the options and opens their menu. */
async function openOptions(timezone: string) {
	const screen = await render(<Options timezone={timezone} />);
	await screen.getByRole('button', { name: 'Options' }).click();

	return {
		issueDate: screen.getByRole('menuitem', { name: 'Date of issue' }),
		dueDate: screen.getByRole('menuitem', { name: 'Due date' }),
		day: (name: string) => screen.getByRole('button', { name }),
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

	test('Shows the issue date as current date in the config timezone', async () => {
		const { issueDate } = await openOptions('Pacific/Kiritimati');

		await expect.element(issueDate).toHaveTextContent('Jun 16, 2026');
		await expect.element(issueDate).toBeDisabled();
	});

	test('Shows the due date of the draft', async () => {
		const { dueDate } = await openOptions('Pacific/Kiritimati');
		await expect.element(dueDate).toHaveTextContent('Jun 30, 2026');
	});

	test('Updates the due date when a different day is selected', async () => {
		const { dueDate, day } = await openOptions('Pacific/Kiritimati');
		await dueDate.click();
		await day('June 17th').click();

		await expect.element(dueDate).toHaveTextContent('Jun 17, 2026');
	});

	test('Only allows due dates after today in the config timezone', async () => {
		const { dueDate, day } = await openOptions('Pacific/Kiritimati');
		await dueDate.click();

		await expect.element(day('June 10th')).toBeDisabled();
		await expect.element(day('June 16th')).toBeDisabled();
		await expect.element(day('June 17th')).toBeEnabled();
		await expect.element(day('June 20th')).toBeEnabled();
	});
});
