import { MotionGlobalConfig } from 'motion/react';
import { Temporal } from 'temporal-polyfill';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';

import { CreateInvoiceDialog } from './index';
import { type CreateInvoiceConfig } from './types';

const { client, mutateAsync } = vi.hoisted(() => ({
	client: { scdId: crypto.randomUUID(), name: null, organization: 'Acme Inc.' },
	mutateAsync: vi.fn(async () => {}),
}));

// Data hooks hit the API, and the server action pulls in the database
vi.mock('@/lib/actions/invoice', () => ({ createInvoice: vi.fn() }));
vi.mock('@/lib/hooks', () => ({
	useClients: () => ({ data: { data: [{ data: client }] } }),
	useInvoiceMutation: () => ({ mutateAsync }),
	useMediaQuery: () => true,
}));

const getLocators = (screen: RenderResult) => ({
	trigger: screen.getByRole('button', { name: 'New invoice' }),
	dialog: screen.getByRole('dialog', { name: 'Create invoice' }),

	billTo: screen.getByRole('combobox', { name: 'Bill To' }),
	title: screen.getByRole('textbox', { name: 'Title' }),
	emptyItems: screen.getByText('Add an invoice item'),
	submit: screen.getByRole('button', { name: 'Submit' }),
	lineItem: (i: number) => screen.getByRole('listitem', { name: `Item ${i}` }),
});

/** Opens the dialog and fills a draft that passes validation. */
async function renderDialog(overrides?: Partial<CreateInvoiceConfig>) {
	const config: CreateInvoiceConfig = {
		currency: 'AUD',
		locale: 'en-US',
		timezone: 'Australia/Sydney',
		taxRegistration: false,
		taxes: [],
		...overrides,
	};

	const screen = await render(
		<CreateInvoiceDialog config={config}>
			<button type='button'>New invoice</button>
		</CreateInvoiceDialog>,
	);

	const locators = getLocators(screen);
	await locators.trigger.click();

	return { screen, locators };
}

async function fillDraft(props: {
	screen: RenderResult;
	locators: ReturnType<typeof getLocators>;
}) {
	const { screen, locators } = props;

	await locators.title.fill('Draft title');

	// Commit the sole match by keyboard: Firefox drops clicks on the animating popup
	await locators.billTo.fill('Acme');
	await userEvent.keyboard('{Enter}');

	await screen.getByRole('button', { name: 'Add Item' }).click();
	await locators.lineItem(1).getByRole('textbox', { name: 'Description' }).fill('Consulting');

	await screen.getByRole('textbox', { name: 'Quantity' }).fill('2');
	await screen.getByRole('textbox', { name: 'Each' }).fill('100');
}

beforeEach(() => (MotionGlobalConfig.skipAnimations = true));
afterEach(() => (MotionGlobalConfig.skipAnimations = false));

test('Preserves a draft when the dialog is dismissed', async () => {
	const { screen, locators } = await renderDialog();
	await fillDraft({ screen, locators });

	await userEvent.keyboard('{Escape}');
	await expect.element(locators.dialog).not.toBeInTheDocument();
	await locators.trigger.click();

	await expect.element(locators.title).toHaveValue('Draft title');
	await expect.element(locators.billTo).toHaveValue('Acme Inc.');
	await expect.element(locators.lineItem(1)).toBeVisible();
});

test('Discards a draft on cancel', async () => {
	const { screen, locators } = await renderDialog();
	await fillDraft({ screen, locators });

	await screen.getByRole('button', { name: 'Cancel' }).click();
	await expect.element(locators.dialog).not.toBeInTheDocument();
	await locators.trigger.click();

	await expect.element(locators.title).toHaveValue('');
	await expect.element(locators.billTo).toHaveValue('');
	await expect.element(locators.emptyItems).toBeVisible();
});

test('Submits a draft, then closes and resets', async () => {
	const { screen, locators } = await renderDialog();
	await fillDraft({ screen, locators });

	await screen.getByRole('button', { name: 'Submit' }).click();

	await expect
		.poll(() => mutateAsync)
		.toHaveBeenCalledWith(
			expect.objectContaining({ clientDataId: client.scdId, title: 'Draft title' }),
		);

	await expect.element(locators.dialog).not.toBeInTheDocument();
	await locators.trigger.click();

	await expect.element(locators.title).toHaveValue('');
	await expect.element(locators.billTo).toHaveValue('');
	await expect.element(locators.emptyItems).toBeVisible();
});

test('Defaults due date to a fortnight after issuance in the config timezone', async () => {
	// 14 Jun in Pago Pago;
	// 15 Jun in UTC
	const now = Temporal.Instant.from('2026-06-15T10:30:00Z');
	const today = vi
		.spyOn(Temporal.Now, 'plainDateISO')
		.mockImplementation((zone = 'UTC') => now.toZonedDateTimeISO(zone).toPlainDate());
	onTestFinished(() => today.mockRestore());

	const { screen, locators } = await renderDialog({ timezone: 'Pacific/Pago_Pago' });
	await fillDraft({ screen, locators });
	await locators.submit.click();

	await expect
		.poll(() => mutateAsync)
		.toHaveBeenCalledWith(expect.objectContaining({ dueAt: '2026-06-28' }));
});
