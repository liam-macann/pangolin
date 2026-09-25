import { sql } from 'drizzle-orm';
import { check, index, snakeCase, text, unique, uuid } from 'drizzle-orm/pg-core';

import { type Address } from '@/api/dto/address';
import { encrypted } from '@/lib/encrypt/drizzle';
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
		country: text().$type<Address['country']>().notNull(),

		userId: uuid()
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
	},
	t => [
		// Necessary for ownership constraint on config
		unique('uq_address_user').on(t.id, t.userId),

		index('idx_address_user_id').on(t.userId),

		check('chk_dependent_locality_length', sql`char_length(${t.dependentLocality}) <= 255`),
		check('chk_city_length', sql`char_length(${t.city}) <= 255`),
		check('chk_administrative_area_length', sql`char_length(${t.administrativeArea}) <= 255`),
		check('chk_postal_code_length', sql`char_length(${t.postalCode}) <= 20`),
		check('chk_sorting_code_length', sql`char_length(${t.sortingCode}) <= 20`),
		check('chk_country_length', sql`char_length(${t.country}) <= 2`),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Addresses must be stable to be referenced by SCD tables
			update: false,
			delete: authUid(t.userId),
		}),
	],
);
