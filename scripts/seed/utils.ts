import { faker } from '@faker-js/faker';

export type ScdVersion = {
	id: string;
	validFrom: Date;
	validTo: Date | null;
};

export function activeAt<T extends ScdVersion>(versions: T[], date: Date): T {
	return (
		versions.find(v => v.validFrom <= date && (v.validTo === null || v.validTo > date)) ??
		versions[0]
	);
}

export function generateScdIntervals(
	from: Date,
	count: number,
): { validFrom: Date; validTo: Date | null }[] {
	const points = [from, ...faker.date.betweens({ from, to: new Date(), count: count - 1 })];

	return points
		.sort((a, b) => a.getTime() - b.getTime())
		.map((validFrom, i) => ({ validFrom, validTo: points[i + 1] ?? null }));
}
