import { authenticatedRole } from 'drizzle-orm/neon';
import { pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { type CountryCode } from 'lib-address';

import { encrypted } from '@/lib/utils/drizzle';
import { users } from '@/db/schema/auth';

import { authUid, immutable, policy } from './_helpers';

// Schema taken from Google open-source address metadata
// https://github.com/google/libaddressinput/wiki/AddressValidationMetadata
export const address = pgTable(
	'address',
	{
		id: uuid().defaultRandom().primaryKey(),

		// A – Street Address Line(s)
		streetAddress: encrypted('street_address').array(),
		// D – Dependent locality (may be an inner-city district or a suburb)
		dependentLocality: text('dependent_locality'),
		// C – City or Locality
		city: text('city'),
		// S – Administrative area such as a state, province, island etc
		administrativeArea: text('administrative_area'),
		// Z – Zip or postal code
		postalCode: text('postal_code'),
		// X – Sorting code
		sortingCode: text('sorting_code'),
		// Country or territory
		country: text('country').$type<Exclude<CountryCode, 'ZZ'>>().notNull(),

		userId: uuid('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
	},
	t => [
		// Necessary for ownership constraint on config
		unique('uq_address_user').on(t.id, t.userId),

		policy({
			role: authenticatedRole,
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: false,
			delete: authUid(t.userId),
		}),

		// Addresses must be stable to be referenced by SCD tables
		immutable(t),
	],
);
