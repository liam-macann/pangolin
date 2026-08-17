import { z } from 'zod';

import { Config } from './config';

export const Invoice = z
	.object({
		id: z.uuid().meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
		issuedAt: z.iso.date().meta({ examples: ['2026-01-15'] }),
		dueAt: z.iso.date().meta({ examples: ['2026-02-14'] }),
		/** @deprecated Prefer reference */
		partition: z
			.string()
			.nullable()
			.meta({ examples: ['2026'], deprecated: true }),
		/** @deprecated Prefer reference */
		index: z.number().meta({ examples: [1], deprecated: true }),
		title: z
			.string()
			.nullable()
			.meta({ examples: ['Website redesign'] }),
		description: z
			.string()
			.nullable()
			.meta({ examples: ['Design and development services for Q1'] }),
		createdAt: z.iso.datetime().meta({ examples: ['2026-01-15T09:30:00.000Z'] }),
		netTotal: z.number().meta({ examples: [1200.99] }),
		grossTotal: z.number().meta({ examples: [1440.24] }),
		reference: z.string().meta({ examples: ['INV-001'] }),
		clientData: z.object({
			name: z
				.string()
				.nullable()
				.meta({ examples: ['Jane Doe'] }),
			organization: z
				.string()
				.nullable()
				.meta({ examples: ['Acme Inc.'] }),
			clientId: z.uuid().meta({ examples: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'] }),
		}),
		config: Config.pick({ timezone: true, currency: true, numberingScheme: true }),
		status: z.object({
			status: z.enum(['unpaid', 'paid', 'refunded']),
			notes: z
				.string()
				.nullable()
				.meta({ examples: ['Paid via bank transfer'] }),
			isVoid: z.boolean(),
		}),
	})
	.meta({ ref: 'Invoice', description: 'An invoice belonging to the current user.' });

export type Invoice = z.infer<typeof Invoice>;
