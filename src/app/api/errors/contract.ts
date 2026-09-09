import { type ContentfulStatusCode } from 'hono/utils/http-status';
import { resolver } from 'hono-openapi';
import { problemDetails } from 'hono-problem-details';

import { type ProblemKey, type ProblemStatus, problems } from '@/api/errors/registry';
import { ProblemDetails } from '@/api/errors/schema';
import { type Unique } from '@/lib/utils';

/** Returns a union of registry keys that match the given status code
 * @example ProblemKeyForStatus<405> → "METHOD_NOT_ALLOWED" */
type ProblemMatchingStatus<Status extends number> = {
	[Key in ProblemKey]: ProblemStatus<Key> extends Status ? Key : never;
}[ProblemKey];

/** Returns a union of the specified numeric status code and matching registry keys */
type ProblemReference<Status extends ContentfulStatusCode> = Status | ProblemMatchingStatus<Status>;

type ProblemContractEntry<Status extends ContentfulStatusCode> = {
	description: string;
	problems: readonly [ProblemReference<Status>, ...ProblemReference<Status>[]];
};

type ProblemContractEntries = Partial<{
	[Status in ContentfulStatusCode]: ProblemContractEntry<Status>;
}>;

type ValidateUniqueProblems<Entries extends ProblemContractEntries> = {
	[Status in keyof Entries]: Entries[Status] extends {
		problems: infer Problems extends readonly unknown[];
	}
		? Omit<Entries[Status], 'problems'> & { problems: Unique<Problems> }
		: Entries[Status];
};

const problemExample = (key: ProblemKey | number) =>
	typeof key === 'number' ? problemDetails({ status: key }).problemDetails : problems.get(key);

const problemExampleName = (key: ProblemKey | number) =>
	typeof key === 'number' ? `http-${key}` : key.toLowerCase().replaceAll('_', '-');

/** Builds an OpenAPI schema response for a single problem details error code */
const problemResponse = (
	status: number,
	description: string,
	problems: readonly (ProblemKey | number)[],
) => {
	if (new Set(problems).size !== problems.length)
		throw new Error(`Problem references must be unique within the ${status} response`);

	return {
		description: description || `HTTP ${status} error.`,
		content: {
			'application/problem+json': {
				schema: resolver(ProblemDetails),
				examples: Object.fromEntries(
					problems.map(key => {
						const example = problemExample(key);
						if (example.status !== status) {
							throw new Error(
								`${String(key)} has status ${example.status}, but was declared under a ${status} response`,
							);
						}

						return [problemExampleName(key), { summary: example.title, value: example }];
					}),
				),
			},
		},
	};
};

/** Allows specifying problem errors from the registry, alongside a route-specific description
 * @remarks Includes middleware responses by default */
export const problemContract = <const T extends ProblemContractEntries>(
	entries: T & ValidateUniqueProblems<T>,
) => {
	return Object.fromEntries([
		[500, problemResponse(500, 'Unexpected server error.', [500])],

		...Object.entries(entries).map(([key, entry]) => {
			const status = Number(key);
			return [status, problemResponse(status, entry.description, entry.problems)];
		}),
	]);
};
