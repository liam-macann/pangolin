'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { updateUserConfig } from '@/lib/actions/config';
import type { getUserConfig } from '@/lib/data';
import { config as formSchema } from '@/lib/validation/config';
import { Button } from '@/ui/button';
import { TextTooltip } from '@/ui/tooltip';

import { Customization } from './sections/customization';
import { Details } from './sections/details';
import { Localization } from './sections/localization';
import { Taxation } from './sections/taxation';

/** Mutable value that records the latest config record known to the client. Updates on successful form submission, and used to reset the form. */
let latestConfig: z.input<typeof formSchema> | undefined;

/** Transforms the DB config response into schema input format */
const configAdapter = (
	config: Awaited<ReturnType<typeof getUserConfig>>,
): z.input<typeof formSchema> => ({
	// Schema validation is strict. Avoid destructuring to prevent additional keys.

	timezone: config.timezone,
	region: config.region,
	currency: config.currency,
	taxRegistration: config.taxRegistration,
	numberingScheme: config.numberingScheme,
	colorScheme: config.colorScheme,

	taxes: config.taxes.map(t => ({ name: t.name, rate: t.rate * 100 })),
	paymentDetails: config.paymentDetails || [],
	tradingName: config.tradingName,
	registrationNumber: config.registrationNumber || [],
	// Necessary to enforce object shape
	// eg. isDirty comparison will fail if objects don't share the same keys
	address: config.address && {
		streetAddress: config.address.streetAddress || [''],
		dependentLocality: config.address.dependentLocality || '',
		city: config.address.city || '',
		administrativeArea: config.address.administrativeArea || '',
		postalCode: config.address.postalCode || '',
		sortingCode: config.address.sortingCode || '',
		country: config.address.country,
	},
});

export default function ConfigForm({
	config,
}: {
	config: Awaited<ReturnType<typeof getUserConfig>>;
}) {
	if (!latestConfig) latestConfig = configAdapter(config);

	const methods = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: latestConfig,
	});
	const {
		formState: { isDirty, isSubmitting },
		handleSubmit,
		control,
		reset,
	} = methods;

	const revertToSavepoint = () => {
		// Prevent form submission triggering AnimatePresence
		setFormVersion(v => v + 1);
		reset(latestConfig);
	};

	const [formVersion, setFormVersion] = useState(0); // Reset counter

	return (
		<FormProvider {...methods}>
			<form
				className='grid gap-12'
				onSubmit={handleSubmit(
					async config => {
						// Prevent duplicate submissions
						if (isSubmitting) return;
						else if (!isDirty) {
							toast.info('You have not made any changes');
							return;
						}

						const promise = updateUserConfig({
							...config,
							taxes: config.taxes.map(tax => ({
								...tax,
								// Convert the whole number percentage back to a decimal
								rate: Number(tax.rate) / 100,
							})),
						}).then(() => {
							// Update the reset savepoint with new values
							latestConfig = config;
							revertToSavepoint();
						});

						toast.promise(promise, {
							loading: 'Updating settings…',
							success: 'Settings updated successfully',
							error: 'Failed to update configuration',
						});

						return promise;
					},
					() => toast.warning('Please ensure all fields are filled correctly'),
				)}
			>
				<Customization control={control} />
				{/* Keys prevent form submission from triggering AnimatePresence */}
				<Taxation key={`taxation_${formVersion}`} control={control} />
				<Details key={`details_${formVersion}`} control={control} />
				<Localization control={control} />

				<div className='-mx-2 sticky bottom-0 mt-14 flex grid-cols-2 gap-2 border-t bg-background px-2 py-4 pb-6 max-sm:grid max-md:fixed max-md:right-0 max-md:left-0 max-md:px-8 sm:justify-end'>
					<Button
						type='button'
						variant='ghost'
						onClick={revertToSavepoint}
						disabled={!isDirty || isSubmitting}
					>
						Cancel
					</Button>
					<TextTooltip
						content='You have not made changes'
						disabled={isDirty || isSubmitting}
						render={
							<span>
								<Button type='submit' variant='primary' disabled={!isDirty || isSubmitting}>
									Save changes
								</Button>
							</span>
						}
					/>
				</div>
			</form>
		</FormProvider>
	);
}
