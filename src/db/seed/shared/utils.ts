import { type NumberOrRange } from '@faker-js/faker';
import { Temporal } from 'temporal-polyfill';

import { toTemporal } from '@/lib/utils/date';

import { type SeedContext } from './context';

export type Validity = { validFrom: Temporal.InstantLike; validTo: Temporal.InstantLike | null };

/** Finds the version whose validity covers the instant (inclusive start, exclusive end).
 *  @throws When no version covers the instant */
export function activeAt<T extends Validity>(versions: T[], instant: Temporal.Instant): T {
	const version = versions.find(
		v =>
			Temporal.Instant.compare(v.validFrom, instant) <= 0 &&
			(v.validTo === null || Temporal.Instant.compare(v.validTo, instant) > 0),
	);

	if (!version) throw new Error(`No version is active at ${instant}`);
	return version;
}

/** Finds overridden properties at an index position.
 *
 * @remarks Seeders may accept either:
 * - a root array, which maps over seeded entities
 * - a root object, which applies to every seeded entity */
export const overrideAt = <T extends object>(
	overrides: T | T[] | undefined,
	position: number,
): T | undefined => (Array.isArray(overrides) ? overrides[position] : overrides);

/** Lines returned rows up with the order they were built in, so each matches its override.
 *  @remarks `RETURNING` does not guarantee insertion order. */
export const inBuiltOrder = <Row extends { id: string }>(rows: Row[], built: { id: string }[]) => {
	const position = new Map(built.map((row, i) => [row.id, i]));
	return rows.toSorted((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
};

/** The span of time that seeded data is dated within, and the random source to place it */
type HistoryContext = Pick<SeedContext, 'faker' | 'from' | 'to'>;

/** Random instants within the history, in chronological order. */
export const instantsBetween = ({ faker, from, to }: HistoryContext, count: NumberOrRange) =>
	faker.date
		.betweens({ from: from.epochMilliseconds, to: to.epochMilliseconds, count })
		.map(date => toTemporal.decode(date));

/** Splits history into consecutive validity periods, starting at `from` and ending in an active version.
 * @throws When the resolved history contains fewer than one version. */
export function versionIntervals(ctx: HistoryContext, count: NumberOrRange) {
	const periods = ctx.faker.helpers.rangeToNumber(count);
	if (periods < 1) throw new Error('History must contain at least one version');
	const points = [ctx.from, ...instantsBetween(ctx, periods - 1)];

	return points.map((validFrom, i) => ({
		validFrom: validFrom.toString(),
		validTo: points.at(i + 1)?.toString() ?? null,
	}));
}
