import { z } from 'zod';

import { Address } from '@/api/dto/address';
import { NumericString } from '@/lib/utils/numeric';
import { colorEnum, numberingScheme } from '@/db/schema';

const ConfigTax = z.object({
	id: z
		.uuid()
		.meta({ examples: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'] })
		.readonly(),
	name: z
		.string()
		.normalize()
		.max(10)
		.meta({ examples: ['VAT', 'GST'] }),
	rate: NumericString.max(12).meta({ examples: ['0.2000'] }),
});

export const Config = z
	.object({
		id: z
			.uuid()
			.meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] })
			.readonly(),
		tradingName: z
			.string()
			.normalize()
			.max(255)
			.meta({ examples: ['Acme Inc.'] }),
		email: z
			.email()
			.normalize()
			.max(255)
			.nullable()
			.meta({ examples: ['billing@acme.example'] }),
		phone: z
			.string()
			.normalize()
			.max(50)
			.nullable()
			.meta({ examples: ['+44 20 7946 0958'] }),
		header: z.string().max(2000).nullable(),
		timezone: z
			.string()
			.normalize()
			.max(64)
			.meta({ examples: ['Europe/London'] }),
		language: z
			.string()
			.normalize()
			.max(3)
			.meta({
				description: 'ISO 639 alpha-2 language code.',
				examples: ['en'],
			}),
		region: z
			.string()
			.normalize()
			.max(20)
			.meta({ examples: ['GB'] }),
		locale: z
			.string()
			.normalize()
			.max(22)
			.meta({ description: 'IETF BCP 47 language tag', examples: ['en-GB'] })
			.readonly(),
		currency: z
			.currencyCode()
			.length(3)
			.meta({
				description: 'ISO 4217 currency code.',
				examples: ['GBP', 'AUD', 'JPY'],
			}),
		address: Address.nullable(),
		taxRegistration: z.boolean(),
		paymentDetails: z
			.array(z.string().normalize().max(255))
			.max(10)
			.nullable()
			.meta({ examples: [['Sort code: 12-34-56', 'Account: 12345678']] }),
		tradingNumber: z
			.array(z.string().normalize().max(255))
			.max(15)
			.nullable()
			.meta({ examples: [['12345678']] }),
		numberingScheme: z.enum(numberingScheme.enumValues),
		colorScheme: z.enum(colorEnum.enumValues),
		taxes: z.array(ConfigTax).max(50),
	})
	.meta({ ref: 'Config', description: 'A configuration record for the current user.' });

export type Config = Readonly<z.infer<typeof Config>>;
