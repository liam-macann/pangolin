'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CountryCode } from 'lib-address';
import { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import { updateUserConfig } from '@/lib/actions/config';
import { type fetchConfig } from '@/lib/data';
import { rateToPercent } from '@/lib/utils';
import { configFields, config as configSchema } from '@/lib/validation/config';

import { Button } from '@/ui/button';
import { toast } from '@/ui/toast';
import { TextTooltip } from '@/ui/tooltip';

// Form sections
import { Customization } from './sections/customization';
import { Details } from './sections/details';
import { Localization } from './sections/localization';
import { Taxation } from './sections/taxation';

/** Uses local addressEnabled flag to toggle address validation, and drops it after parsing */
const formSchema = configFields
	.omit({ address: true })
	.extend({ addressEnabled: z.boolean(), address: z.any() })
	.transform((val): z.input<typeof configSchema> => {
		return {
			...val,
			address: val.addressEnabled ? val.address : null,
		};
	})
	.pipe(configSchema.safeExtend({ addressEnabled: z.boolean() }));

type FormInput = z.input<typeof formSchema>;

/** Parses a config detail, stored in raw `"label: value"` storage format, into structured form input */
const parseDetail = (v: string) => {
	const [label, value] = v.split(/: (.*)/s);
	return { label, value };
};

/** Transforms the DB config response into schema input format */
const configAdapter = (config: Awaited<ReturnType<typeof fetchConfig>>): FormInput => ({
	// Schema validation is strict. Avoid destructuring to prevent additional keys.

	timezone: config.timezone,
	region: config.region,
	currency: config.currency,
	taxRegistration: config.taxRegistration,
	numberingScheme: config.numberingScheme,
	colorScheme: config.colorScheme,

	taxes: config.taxes.map(t => ({ name: t.name, rate: rateToPercent(t.rate) })),
	paymentDetails: config.paymentDetails?.map(parseDetail) || [],
	tradingName: config.tradingName,
	email: config.email || '',
	phone: config.phone || '',
	header: config.header || '',
	tradingNumber: config.tradingNumber?.map(parseDetail) || [],

	addressEnabled: !!config.address,
	// Specifying keys necessary to enforce object shape
	// Form `isDirty` comparison will fail if keys do not match
	address: {
		streetAddress: config.address?.streetAddress || [''],
		dependentLocality: config.address?.dependentLocality || '',
		city: config.address?.city || '',
		administrativeArea: config.address?.administrativeArea || '',
		postalCode: config.address?.postalCode || '',
		sortingCode: config.address?.sortingCode || '',

		// Country may be null in incomplete form state — address validation is dependent on addressEnabled state.
		// Assertion is necessary as input is transformed through Zod schema.
		country: (config.address?.country || null) as Exclude<CountryCode, 'ZZ'>,
	},
});

export default function ConfigForm({
	config,
}: {
	config: Awaited<ReturnType<typeof fetchConfig>>;
}) {
	/** Mutable value that records the latest config record known to the client.
	 *  Updates on successful form submission, and used to reset the form. */
	const savepoint = useRef<FormInput>(configAdapter(config));

	const methods = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: savepoint.current,
	});
	const {
		formState: { isDirty, isSubmitting },
		handleSubmit,
		control,
		reset: _reset,
	} = methods;

	/** Resets the form to the latest savepoint, optionally first updating the savepoint with a new value. */
	const revertToSavepoint = (update?: FormInput) => {
		if (update) savepoint.current = update;

		// Prevent form submission triggering AnimatePresence
		setFormVersion(v => v + 1);
		_reset(savepoint.current);
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
						// Prevent redundant submissions
						else if (!isDirty) {
							toast.info('You have not made any changes');
							return;
						}

						const { addressEnabled, ...payload } = config;
						const promise = updateUserConfig(payload).then(() => revertToSavepoint(config));

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
				<Details key={`details_${formVersion}`} control={control} />
				<Taxation key={`taxation_${formVersion}`} control={control} />
				<Localization control={control} />

				<div className='sticky bottom-0 -mx-2 mt-14 flex grid-cols-2 gap-2 border-t bg-background px-2 py-4 pb-6 max-sm:grid max-md:fixed max-md:right-0 max-md:left-0 max-md:px-8 sm:justify-end'>
					<Button
						type='button'
						variant='ghost'
						onClick={() => revertToSavepoint()}
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
