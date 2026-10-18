import { z } from 'zod';

export const Direction = z.enum(['asc', 'desc']);
export type Direction = z.infer<typeof Direction>;

/** Fields to sort by, most significant first. */
export type Sort<TName extends PropertyKey> = Partial<Record<TName, Direction>>;

/** Builds a Zod schema that expresses legal sort fields as query parameters. */
export const sortParam = <TName extends string>(names: TName[]) => {
	// A comma delimits and a leading minus reverses, so a name using either could not be read
	if (names.some(name => name.includes(',') || name.startsWith('-')))
		throw new Error('A sort field name cannot contain a comma or start with a minus');

	return z
		.array(z.enum(names.flatMap(name => [name, `-${name}` as const])))
		.max(names.length)
		.meta({
			description:
				'Fields to sort by, most significant first. Ascending by default, or descending when prefixed with `-`.',
		})
		.transform(terms =>
			terms.reduce<Sort<TName>>((sort, term) => {
				const name = term.replace(/^-/, '');

				// A field orders the list once, so a repeat of it has nothing left to order
				if (z.enum(names).validate(name) && !(name in sort))
					sort[name] = term.startsWith('-') ? 'desc' : 'asc';

				return sort;
			}, {}),
		);
};
