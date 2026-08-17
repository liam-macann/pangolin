import { z } from 'zod';

import { Address } from '@/api/dto/address';

export const Client = z
	.object({
		id: z.uuid().meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
		isFavorite: z.boolean(),
		isDeleted: z.boolean(),
		invoiceCount: z.number().meta({ examples: [12] }),
		data: z.object({
			name: z
				.string()
				.nullable()
				.meta({ examples: ['Alaric Wivell'] }),
			organization: z
				.string()
				.nullable()
				.meta({ examples: ['Acme Inc.'] }),
			scdId: z.uuid().meta({ examples: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'] }),
			email: z.string().meta({ examples: ['alaric@acme.org'] }),
			notes: z
				.string()
				.nullable()
				.meta({ examples: ['Prefers email invoices'] }),
			address: Address.nullable(),
			formattedAddress: z
				.string()
				.nullable()
				.meta({ examples: ['123 Main St, London, EC1A 1BB, United Kingdom'] }),
		}),
	})
	.meta({ ref: 'Client', description: 'A client record belonging to the current user.' });

export type Client = z.infer<typeof Client>;
