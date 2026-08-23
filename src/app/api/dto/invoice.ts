import { z } from 'zod';

import { Config } from './config';

export const Invoice = z
	.object({
		id: z
			.uuid()
			.meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] })
			.readonly(),
		issuedAt: z.iso.date().meta({ examples: ['2026-01-15'] }),
		dueAt: z.iso.date().meta({ examples: ['2026-02-14'] }),
		/** @deprecated Prefer reference */
		partition: z
			.string()
			.normalize()
			.max(50)
			.nullable()
			.meta({ examples: ['2026'], deprecated: true })
			.readonly(),
		/** @deprecated Prefer reference */
		index: z
			.number()
			.meta({ examples: [1], deprecated: true })
			.readonly(),
		title: z
			.string()
			.normalize()
			.max(2000)
			.nullable()
			.meta({ examples: ['Website redesign'] }),
		description: z
			.string()
			.normalize()
			.max(2000)
			.nullable()
			.meta({ examples: ['Design and development services for Q1'] }),
		createdAt: z.iso
			.datetime({ precision: 3 })
			.meta({ examples: ['2026-01-15T09:30:00.000Z'] })
			.readonly(),
		netTotal: z
			.number()
			.meta({ examples: [1200.99] })
			.readonly(),
		grossTotal: z
			.number()
			.meta({ examples: [1440.24] })
			.readonly(),
		reference: z
			.string()
			.normalize()
			.max(255)
			.meta({ examples: ['INV-001'] })
			.readonly(),
		clientData: z.object({
			name: z
				.string()
				.normalize()
				.max(255)
				.nullable()
				.meta({ examples: ['Jane Doe'] }),
			organization: z
				.string()
				.normalize()
				.max(255)
				.nullable()
				.meta({ examples: ['Acme Inc.'] }),
			clientId: z.uuid().meta({ examples: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'] }),
		}),
		config: Config.pick({ timezone: true, currency: true, numberingScheme: true }),
		status: z.object({
			status: z.enum(['unpaid', 'paid', 'refunded']),
			notes: z
				.string()
				.normalize()
				.max(2000)
				.nullable()
				.meta({ examples: ['Paid via bank transfer'] }),
			isVoid: z.boolean(),
		}),
	})
	.meta({ ref: 'Invoice', description: 'An invoice belonging to the current user.' });

export type Invoice = Readonly<z.infer<typeof Invoice>>;
