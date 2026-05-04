import { snakeCase, text, unique, uuid } from 'drizzle-orm/pg-core';
import { type CountryCode } from 'lib-address';

import { encrypted } from '@/lib/utils/drizzle';
import { users } from '@/db/schema/auth';

import { authUid, policy } from './_helpers';

// Schema taken from Google open-source address metadata
// https://github.com/google/libaddressinput/wiki/AddressValidationMetadata
export const address = snakeCase.table(
	'address',
	{
		id: uuid().defaultRandom().primaryKey(),

		// A – Street Address Line(s)
		streetAddress: encrypted().array(),
		// D – Dependent locality (may be an inner-city district or a suburb)
		dependentLocality: text(),
		// C – City or Locality
		city: text(),
		// S – Administrative area such as a state, province, island etc
		administrativeArea: text(),
		// Z – Zip or postal code
		postalCode: text(),
		// X – Sorting code
		sortingCode: text(),
		// Country or territory
		country: text().$type<Exclude<CountryCode, 'ZZ'>>().notNull(),

		userId: uuid()
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
	},
	t => [
		// Necessary for ownership constraint on config
		unique('uq_address_user').on(t.id, t.userId),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Addresses must be stable to be referenced by SCD tables
			update: false,
			delete: authUid(t.userId),
		}),
	],
);
