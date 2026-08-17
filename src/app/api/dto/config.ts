import { z } from 'zod';

import { Address } from '@/api/dto/address';
import { colorEnum, numberingScheme } from '@/db/schema';

const ConfigTax = z.object({
	id: z.uuid().meta({ examples: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'] }),
	name: z.string().meta({ examples: ['VAT'] }),
	rate: z.number().meta({ examples: [20] }),
});

export const Config = z
	.object({
		id: z.uuid().meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
		tradingName: z.string().meta({ examples: ['Acme Inc.'] }),
		email: z
			.string()
			.nullable()
			.meta({ examples: ['billing@acme.example'] }),
		phone: z
			.string()
			.nullable()
			.meta({ examples: ['+44 20 7946 0958'] }),
		header: z.string().nullable(),
		timezone: z.string().meta({ examples: ['Europe/London'] }),
		language: z.string().meta({ examples: ['en'] }),
		region: z.string().meta({ examples: ['GB'] }),
		locale: z.string().meta({ examples: ['en-GB'] }),
		currency: z.string().meta({ examples: ['GBP'] }),
		address: Address.nullable(),
		taxRegistration: z.boolean(),
		paymentDetails: z
			.array(z.string())
			.nullable()
			.meta({ examples: [['Sort code: 12-34-56', 'Account: 12345678']] }),
		tradingNumber: z
			.array(z.string())
			.nullable()
			.meta({ examples: [['12345678']] }),
		numberingScheme: z.enum(numberingScheme.enumValues),
		colorScheme: z.enum(colorEnum.enumValues),
		taxes: z.array(ConfigTax),
	})
	.meta({ ref: 'Config', description: 'A configuration record for the current user.' });

export type Config = z.infer<typeof Config>;
