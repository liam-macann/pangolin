import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type CountryCode, registerCountry } from 'lib-address';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';

import { type AddressMetadata } from '@/api/dto/address';
import { useAddressMetadata as useQueryAddressMetadata } from '@/lib/hooks/data/address';

import { AddressInput, type FormValues } from '.';

type Fields =
	| 'street'
	| 'dependentLocality'
	| 'city'
	| 'administrativeArea'
	| 'zip'
	| 'sortingCode'
	| 'country';

const { useAddressMetadata } = vi.hoisted(() => ({ useAddressMetadata: vi.fn() }));

const countryMetadata = {
	CA: {
		id: 'data/CA',
		key: 'CA',
		name: 'CANADA',
		require: 'ACSZ',
		upper: 'CS',
		fmt: '%N%n%O%n%A%n%C %S %Z',
		state_name_type: 'province',
		locality_name_type: 'city',
		sublocality_name_type: 'suburb',
		zip_name_type: 'postal',
	},
	US: {
		id: 'data/US',
		key: 'US',
		name: 'UNITED STATES',
		require: 'ACSZ',
		upper: 'CS',
		fmt: '%N%n%O%n%A%n%C, %S %Z',
		state_name_type: 'state',
		locality_name_type: 'city',
		sublocality_name_type: 'neighborhood',
		zip_name_type: 'zip',
		sub_regions: [
			{ key: 'CA', name: { default: 'California' } },
			{ key: 'NY', name: { latin: 'New York', default: 'New York' } },
		],
	},
	AU: {
		id: 'data/AU',
		key: 'AU',
		name: 'AUSTRALIA',
		require: 'ADCSZX',
		upper: 'CS',
		fmt: '%N%n%O%n%A%n%D%n%C%n%S%n%Z%n%X',
		state_name_type: 'state',
		locality_name_type: 'district',
		sublocality_name_type: 'neighborhood',
		zip_name_type: 'postal',
	},
} satisfies Record<string, AddressMetadata>;

const testCountries = {
	withSubregion: 'US',
	withAllFields: 'AU',
} as const satisfies Record<string, keyof typeof countryMetadata>;

vi.mock('@/lib/hooks', () => ({ useAddressMetadata }));

// Field names are derived from country metadata, so aren't stable across locales
const getAddressField = (screen: RenderResult, field: Fields) =>
	screen.getByTestId(`address-${field}`);

function TestForm({
	address = null,
	disabled,
}: {
	address?: FormValues['address'];
	disabled?: boolean;
}) {
	const methods = useForm<FormValues>({ defaultValues: { address } });
	return (
		<FormProvider {...methods}>
			<AddressInput control={methods.control} disabled={disabled} />
		</FormProvider>
	);
}

beforeEach(() => {
	useAddressMetadata.mockReset();
	useAddressMetadata.mockImplementation((countryCode: CountryCode) => {
		const metadata = countryCode
			? countryMetadata[countryCode as keyof typeof countryMetadata]
			: undefined;

		if (metadata) registerCountry(metadata);

		return {
			data: metadata,
			isLoading: false,
			error: undefined,
		};
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('AddressInput', () => {
	test('Shows a useful international form before a country is selected', async () => {
		const screen = await render(<TestForm />);

		/** Fields rendered by the generic international format, before a country narrows them further */
		const defaultFields = ['street', 'city', 'administrativeArea', 'zip', 'country'] as const;

		await Promise.all(
			defaultFields.map(async name => {
				const field = getAddressField(screen, name);

				await expect.element(field).toBeVisible();
				await expect.element(field).toBeEnabled();
			}),
		);
	});

	test('Uses country metadata to selectively display and label fields', async () => {
		const screen = await render(<TestForm address={{ country: 'CA' }} />);
		expect(useAddressMetadata.mock.lastCall?.[0]).toBe('CA');

		const street = getAddressField(screen, 'street');
		await expect.element(street).toBeVisible();

		const state = getAddressField(screen, 'administrativeArea');
		await expect.element(state).toBeVisible();
		await expect.element(state).toHaveAccessibleName(/province/i);

		const city = getAddressField(screen, 'city');
		await expect.element(city).toBeVisible();
		await expect.element(city).toHaveAccessibleName(/city/i);

		const postal = getAddressField(screen, 'zip');
		await expect.element(postal).toBeVisible();
		await expect.element(postal).toHaveAccessibleName(/postal code/i);

		const country = getAddressField(screen, 'country');
		await expect.element(country).toHaveValue('Canada');

		await expect.element(getAddressField(screen, 'dependentLocality')).not.toBeInTheDocument();
	});

	test('Updates the address format when a country is selected', async () => {
		const screen = await render(<TestForm />);
		const country = getAddressField(screen, 'country');

		await userEvent.click(country);
		await userEvent.fill(country, 'Canada');
		const option = screen.getByRole('option', { name: 'Canada' });
		await expect.element(option).toBeVisible();
		await userEvent.click(option);

		await expect.poll(() => useAddressMetadata.mock.lastCall?.[0]).toBe('CA');

		await expect.element(country).toHaveValue('Canada');
		await expect
			.element(getAddressField(screen, 'administrativeArea'))
			.toHaveAccessibleName(/province/i);
	});

	test('Keeps the previous address format while the next country loads', async () => {
		useAddressMetadata.mockImplementation(useQueryAddressMetadata);

		const nextCountry = Promise.withResolvers<Response>();
		vi.stubGlobal(
			'fetch',
			vi.fn((input: RequestInfo | URL) => {
				if (String(input).endsWith('/AU'))
					return Promise.resolve(Response.json({ data: countryMetadata.AU }));

				return nextCountry.promise;
			}),
		);

		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const screen = await render(
			<QueryClientProvider client={queryClient}>
				<TestForm address={{ country: 'AU' }} />
			</QueryClientProvider>,
		);

		async function invariantAU(assertions?: (input: Locator) => Promise<unknown>) {
			const fields = ['zip', 'sortingCode'] as const;
			fields.map(async field => {
				const input = getAddressField(screen, field);
				await expect.element(input).toBeVisible();
				await assertions?.(input);
			});

			// Check that postal field has localised label
			const postal = getAddressField(screen, 'zip');
			await expect.element(postal).toHaveAccessibleName(/postal code/i);
		}

		await invariantAU(input => expect.element(input).toBeEnabled());

		// Switch country; UI in loading state
		const country = getAddressField(screen, 'country');
		await userEvent.click(country);
		await userEvent.fill(country, 'United States');
		await userEvent.click(screen.getByRole('option', { name: 'United States' }));
		await expect.element(screen.getByTestId(`address-locale`)).toHaveAttribute('aria-busy');

		await invariantAU(input => expect.element(input).toBeDisabled());

		// Loading has settled; US fields visible
		nextCountry.resolve(Response.json({ data: countryMetadata.US }));

		// Check that postal field has localised label
		const postal = getAddressField(screen, 'zip');
		await expect.element(postal).toHaveAccessibleName(/zip code/i);

		// Check that fields have unmounted
		await expect.element(getAddressField(screen, 'sortingCode')).not.toBeInTheDocument();
	});

	test('Renders every field from the kitchen sink locale', async () => {
		const screen = await render(<TestForm address={{ country: testCountries.withAllFields }} />);

		await expect.element(getAddressField(screen, 'street')).toBeVisible();
		await expect.element(getAddressField(screen, 'dependentLocality')).toBeVisible();
		await expect.element(getAddressField(screen, 'city')).toBeVisible();
		await expect.element(getAddressField(screen, 'administrativeArea')).toBeVisible();
		await expect.element(getAddressField(screen, 'zip')).toBeVisible();
		await expect.element(getAddressField(screen, 'sortingCode')).toBeVisible();
		await expect.element(getAddressField(screen, 'country')).toHaveValue('Australia');
	});

	describe('Administrative sub-region combobox', () => {
		test('Selects an administrative sub-region from the combobox', async () => {
			const screen = await render(<TestForm address={{ country: testCountries.withSubregion }} />);

			const state = getAddressField(screen, 'administrativeArea');

			await userEvent.click(screen.getByTestId('address-administrativeArea-trigger'));

			const option = screen.getByRole('option', { name: 'California' });
			await expect.element(option).toBeVisible();
			await userEvent.click(option);

			await expect.element(state).toHaveValue('California');
		});

		test('Clears an administrative sub-region that is not in the metadata', async () => {
			const screen = await render(
				<TestForm address={{ country: testCountries.withAllFields, administrativeArea: 'XX' }} />,
			);

			await expect.element(getAddressField(screen, 'administrativeArea')).toHaveValue('XX');

			const country = getAddressField(screen, 'country');

			await userEvent.click(country);
			await userEvent.fill(country, 'United States');
			const option = screen.getByRole('option', { name: 'United States' });
			await expect.element(option).toBeVisible();
			await userEvent.click(option);

			expect(useAddressMetadata.mock.lastCall?.[0]).toBe(testCountries.withSubregion);
			await expect.element(getAddressField(screen, 'administrativeArea')).toHaveValue('');
		});

		test('Disables combobox trigger when disabled', async () => {
			const screen = await render(
				<TestForm disabled address={{ country: testCountries.withSubregion }} />,
			);

			await expect.element(getAddressField(screen, 'administrativeArea')).toBeDisabled();
			await expect.element(screen.getByTestId('address-administrativeArea-trigger')).toBeDisabled();
		});
	});

	test('Disables input while country metadata is loading', async () => {
		useAddressMetadata.mockReturnValue({ data: undefined, isLoading: true, error: undefined });

		const screen = await render(<TestForm address={{ country: 'CA' }} />);

		const countryField = getAddressField(screen, 'country');

		// Get all disableable elements
		const controls = screen
			.getByRole('textbox')
			.or(screen.getByRole('combobox'))
			.or(screen.getByRole('button'))
			.all()
			.filter(
				control =>
					control.element() !== countryField.element() &&
					control.element() !== screen.getByTestId('address-country-trigger').element(),
			);

		assert(controls.length > 0, 'Address form should render controls');
		await Promise.all(controls.map(control => expect.element(control).toBeDisabled()));

		await expect.element(countryField).toBeEnabled();

		await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
	});

	test('Disables every address control when disabled', async () => {
		const screen = await render(
			<TestForm disabled address={{ country: testCountries.withAllFields }} />,
		);

		// Get all disableable elements
		const controls = screen
			.getByRole('textbox')
			.or(screen.getByRole('combobox'))
			.or(screen.getByRole('button'))
			.all();

		assert(controls.length > 0, 'Address form should render controls');
		await Promise.all(controls.map(control => expect.element(control).toBeDisabled()));
	});

	test('Renders the error boundary fallback when the localized form throws', async () => {
		useAddressMetadata.mockImplementation(() => {
			throw new Error('metadata failure');
		});

		vi.spyOn(console, 'error').mockImplementation(() => {});

		const screen = await render(<TestForm address={{ country: 'CA' }} />);
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent(/something went wrong! check your network connection/i);

		// Important to allow users to retry
		const country = getAddressField(screen, 'country');
		await expect.element(country).toBeVisible();
		await expect.element(country).toBeEnabled();
	});

	test('Renders alert when country metadata cannot be loaded', async () => {
		useAddressMetadata.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error('network'),
		});

		const screen = await render(<TestForm address={{ country: 'AU' }} />);

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent(/failed to load address format/i);

		await expect
			.element(screen.getByText(/please refresh the page, and try again later\./i))
			.toBeVisible();

		const country = getAddressField(screen, 'country');
		await expect.element(country).toBeVisible();
	});

	describe('Street address', () => {
		describe('"Add address line" button', () => {
			test('Appends a new line', async () => {
				const screen = await render(
					<TestForm address={{ country: 'CA', streetAddress: ['One', 'Two', 'Three'] }} />,
				);

				const street = getAddressField(screen, 'street');
				const addLine = screen.getByRole('button', { name: /add address line/i });

				await expect.element(addLine).toBeEnabled();
				await userEvent.click(addLine);

				await expect.element(street).toHaveValue('One\nTwo\nThree\n');
				await expect.element(addLine).toBeDisabled();
			});

			test('Passes focus to field', async () => {
				const screen = await render(
					<TestForm address={{ country: 'CA', streetAddress: ['One', 'Two'] }} />,
				);

				const street = getAddressField(screen, 'street');
				await expect.element(street).not.toHaveFocus();

				const addLine = screen.getByRole('button', { name: /add address line/i });

				await expect.element(addLine).toBeEnabled();
				await userEvent.click(addLine);

				await expect.element(street).toHaveValue('One\nTwo\n');
				await expect.element(street).toHaveFocus();
			});
		});

		test('Limits street addresses to four lines when text is typed', async () => {
			const screen = await render(<TestForm />);

			const street = getAddressField(screen, 'street');

			await userEvent.type(street, 'One{Enter}Two{Enter}Three{Enter}Four{Enter}Five');

			await expect.element(street).toHaveValue('One\nTwo\nThree\nFourFive');
			await expect
				.element(screen.getByRole('button', { name: /add address line/i }))
				.toBeDisabled();
		});

		test('Limits street address to four lines when multiple lines are inserted at once', async () => {
			const screen = await render(<TestForm />);

			const street = getAddressField(screen, 'street');

			await userEvent.fill(street, 'One\nTwo\nThree\nFour\nFive');

			await expect.element(street).toHaveValue('One\nTwo\nThree\nFour');
			await expect
				.element(screen.getByRole('button', { name: /add address line/i }))
				.toBeDisabled();
		});
	});
});
