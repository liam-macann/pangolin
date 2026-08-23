import { getTimeZones } from '@vvo/tzdb';
import { getCountryDataList } from 'countries-list';
import { createInsertSchema } from 'drizzle-orm/zod';
import z from 'zod/v4';

import { currencies } from '@/lib/utils/currencies';
import { intlNumber } from '@/lib/zod';
import { config as configSchema, taxes as taxesSchema } from '@/db/schema/data';

import address from './address';

export const taxes = z
	.array(
		createInsertSchema(taxesSchema, {
			name: s =>
				z
					.string()
					.trim()
					.min(1, 'Please enter a tax label')
					.min(2, 'Label must be at least 2 characters')
					.pipe(s),
			rate: s =>
				intlNumber(
					z
						.number('Tax rate must be a number')
						.multipleOf(0.01, 'You may only define up to two decimal places')
						.min(0, 'Negative taxes are not allowed')
						.max(200, 'Tax may not exceed 200%'),
					'Please enter a quantity',
				).pipe(s),
		}).pick({ name: true, rate: true }),
	)
	.superRefine((arr, ctx) => {
		const seen = new Map<string, number>();

		arr.forEach((item, index) => {
			/** Composite key of name and rate */
			const key = item.name + item.rate.toString();

			if (seen.has(key)) {
				// biome-ignore lint/style/noNonNullAssertion: Guarded in previous condition
				const firstIndex = seen.get(key)!;

				// Error on first and current duplicate item
				[index, firstIndex].forEach(path => {
					ctx.addIssue({
						code: 'custom',
						message: 'Taxes must not share identical label and rate',
						path: [path],
					});
				});
			} else if (item.name !== '' && item.rate !== undefined) seen.set(key, index);
		});
	})
	.max(25, 'You may add up to 25 taxes');

/** Field-level schema for database configuration, excluding generated fields.
 *  Carries no cross-field refinements, so subsets may be derived with pick()/omit()/extend(). */
export const configFields = createInsertSchema(configSchema, {
	tradingName: s => z.string('Required').trim().min(1, 'Required').max(255, 'Too long').pipe(s),
	paymentDetails: z
		.array(
			z.object({
				label: z.string('Required').trim().min(1, 'Required').max(255, 'Too long'),
				value: z.string('Required').trim().min(1, 'Required').max(255, 'Too long'),
			}),
		)
		.max(10, 'No more than 10 items allowed'),
	tradingNumber: z
		.array(
			z.object({
				label: z.string('Required').trim().min(1, 'Required').max(255, 'Too long'),
				value: z.string('Required').trim().min(1, 'Required').max(255, 'Too long'),
			}),
		)
		.max(15, 'No more than 15 items allowed'),
	email: z
		.string()
		.max(255)
		.optional()
		// Normalise the empty string before validation, so an empty field is cleaned rather than rejected
		.transform(value => value?.trim() || undefined)
		.pipe(z.email('Invalid email').optional()),
	phone: z
		.string() // Phone numbers can be alphanumeric, and contain characters (eg. separators, parentheses)
		.max(50)
		.optional()
		.transform(value => value?.trim() || undefined),
	header: z
		.string()
		.optional()
		.transform(value => value?.trim() || undefined),

	currency: s =>
		z
			.enum(
				currencies.map(c => c.iso),
				'Please enter a valid currency',
			)
			.pipe(s),
	timezone: s =>
		z
			.enum(
				getTimeZones().map(tz => tz.name),
				'Please enter a valid timezone',
			)
			.pipe(s),
	region: s =>
		z
			.enum<string[]>(
				getCountryDataList().map(c => c.iso2),
				'Please enter a valid region',
			)
			.pipe(s),
})
	.omit({
		id: true,
		userId: true,
		validFrom: true,
		validTo: true,
		addressId: true,
	})
	.strict()
	.extend({
		address: address.nullish().transform(value => value || null),
		/** Minimal insertion record for database configuration, excluding generated fields */
		taxes: taxes,
	});

/** Complete insertion record for database configuration, excluding generated fields */
export const config = configFields.refine(c => !(c.taxRegistration && c.taxes.length === 0), {
	message: 'Taxes must be provided when registered for tax',
	path: ['taxes'],
});
