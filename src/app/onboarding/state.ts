'use client';

import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import type z from 'zod/v4';
import { create } from 'zustand';

import { updateUserConfig } from '@/lib/actions/config';
import { configFields as config } from '@/lib/validation/config';

type Config = z.input<typeof config>;

interface OnboardingStore {
	page: number;
	pages: number;
	config: Partial<Config>;

	setFields: (fields: Partial<Config>) => void;

	previous: () => void;
	next: () => void;

	goBackTo: (page: number) => void;

	isSubmitting: boolean;
	submit: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
	page: 0,
	pages: 6,
	config: {},

	setFields: fields => set(state => ({ config: { ...state.config, ...fields } })),

	previous: () => set(state => ({ page: state.page - 1 })),
	next: () => {
		if (get().page === get().pages - 1) get().submit();
		else set(state => ({ page: state.page + 1 }));
	},

	// Jumping forward may bypass fields and produce an invalid config. This only allows travelling back to past pages
	goBackTo: (page: number) => set(state => ({ page: page > state.page ? state.page : page })),

	isSubmitting: false,
	submit: async () => {
		if (get().isSubmitting) return;
		set({ isSubmitting: true });

		const { data, error } = await config.safeParseAsync(get().config);

		if (error) {
			toast.error('Please double-check your information and try again.');
			get().goBackTo(1);
			return;
		}

		await toast
			.promise(updateUserConfig(data), {
				loading: 'Getting ready for you...',
				error: 'Something went wrong. Please double-check your information and try again.',
			})
			.unwrap()
			.then(
				() => redirect('/dashboard'),
				// API error
				() => {
					set({ isSubmitting: false });
					get().goBackTo(1);
				},
			);
	},
}));

//
//
//
// Steps
//

export const details = config.pick({ tradingName: true, email: true, tradingNumber: true });
export const payment = config.pick({ paymentDetails: true });
export const localization = config.pick({ timezone: true, region: true, currency: true });
export const customization = config.pick({ numberingScheme: true, colorScheme: true });
export const taxation = config
	.pick({
		taxRegistration: true,
		taxes: true,
	})
	.refine(c => !(c.taxRegistration && c.taxes.length === 0), {
		message: 'Taxes must be provided when registered for tax',
		path: ['taxes'],
	});

type SubsetKeys =
	| keyof z.infer<typeof details>
	| keyof z.infer<typeof payment>
	| keyof z.infer<typeof localization>
	| keyof z.infer<typeof customization>
	| keyof z.infer<typeof taxation>;

/** Omits the keys of optional fields in an object type */
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];

type Assert<T extends never> = T;
/** Checks that the combination of subset forms includes all required fields */
// biome-ignore lint/correctness/noUnusedVariables: Used as compilation test
type MissingKeys = Assert<Exclude<RequiredKeys<z.input<typeof config>>, SubsetKeys>>;
