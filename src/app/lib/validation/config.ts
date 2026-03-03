import { createInsertSchema } from 'drizzle-zod';
import z from 'zod/v4';
import { config as configSchema, taxes as taxesSchema } from '@/db/schema/data';
import { intlNumber } from '../zod';
import address from './address';

export const taxes = z
	.array(
		createInsertSchema(taxesSchema, {
			name: s =>
				z
					.string()
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
	});

/** Complete insertion record for database configuration, excluding generated fields */
export const config = createInsertSchema(configSchema, {
	paymentDetails: z
		.array(
			z.object({
				label: z.string('Required').min(1, 'Required').max(255, 'Too long'),
				value: z.string('Required').min(1, 'Required').max(255, 'Too long'),
			}),
		)
		.max(15, 'No more than 15 items allowed'),
	registrationNumber: z
		.array(
			z.object({
				label: z.string('Required').min(1, 'Required').max(255, 'Too long'),
				value: z.string('Required').min(1, 'Required').max(255, 'Too long'),
			}),
		)
		.max(15, 'No more than 15 items allowed'),
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
		address: address.nullable(),
		/** Minimal insertion record for database configuration, excluding generated fields */
		taxes: taxes,
	});
