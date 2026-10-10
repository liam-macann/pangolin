import { sql } from 'drizzle-orm';

import type * as DTO from '@/api/dto/config';
import * as tables from '@/db/schema';
import { type SeedContext, type SeedOptions } from '@/db/seed/shared/context';
import { overrideAt } from '@/db/seed/shared/utils';

/** What may be overridden for a seeded tax. */
type TaxShape = Pick<DTO.Config['taxes'][number], 'name' | 'rate'>;

/** Familiar tax names, used before faker makes up the rest */
const names = ['GST', 'VAT', 'EXP', 'LCT', 'WET'];

/** Seeds taxes for each requested name and rate.
 * @remarks Like in production, taxes already incidentally extant will be reused. */
export async function seedTaxes(
	{ tx, userId, faker }: SeedContext,
	{ count = names.length, overrides }: SeedOptions<TaxShape> = {},
) {
	const taxes = faker.helpers.multiple(
		(_, i) =>
			({
				id: faker.string.uuid(),
				userId,
				name: names[i] ?? faker.string.alpha({ length: { min: 3, max: 4 }, casing: 'upper' }),
				rate: `${faker.number.float({ min: 0.01, max: 0.5, fractionDigits: 4 })}`,
				...overrideAt(overrides, i),
			}) satisfies typeof tables.taxes.$inferInsert,
		{ count },
	);

	// Sequential upserts preserve override order, including duplicates after database rounding
	return Array.fromAsync(taxes, async tax => {
		const [row] = await tx
			.insert(tables.taxes)
			.values(tax)
			.onConflictDoUpdate({
				target: [tables.taxes.userId, tables.taxes.name, tables.taxes.rate],
				set: { rate: sql`excluded.rate` },
			})
			.returning();

		if (!row) throw new Error(`Seeded tax ${tax.name} at rate ${tax.rate} was not found`);
		return row;
	});
}
