import { z } from 'zod';

import { DEFAULT_INVOICE_SORT } from '@/lib/hooks/data/invoice';

import { fromAPISort, toAPISort } from './table/sort';

/** A URL param, ignored when malformed rather than failing the whole URL. */
const param = z.string().optional().catch(undefined);

/** Table sort, carried as a param string in API format (e.g. `-amount,name`).
 * @remarks Drops unsortable fields and repeats, keeping the first term for each field, as the API does. */
const sort = z.codec(param, z.array(z.object({ id: z.string(), desc: z.boolean() })).optional(), {
	decode: param => {
		const sorting = fromAPISort(param?.split(',') ?? []).filter(
			// Remove duplicates, taking the direction from the first occurrence
			({ id }, i, all) => all.findIndex(other => other.id === id) === i,
		);

		return sorting.length ? sorting : undefined;
	},
	encode: sorting => {
		const value = toAPISort(sorting)?.join(',');
		return value === '' || value === DEFAULT_INVOICE_SORT.join(',') ? undefined : value;
	},
});

/** Page number, which counts from 1 in the URL and from 0 as a table page index. */
const page = z.codec(param, z.int().nonnegative().optional(), {
	decode: param => {
		const number = Number(param);
		return Number.isInteger(number) && number > 1 ? number - 1 : undefined;
	},
	encode: pageIndex => (pageIndex ? String(pageIndex + 1) : undefined),
});

/** Table state the invoices page carries in its URL, keyed by param name.
 * @remarks Decode the whole URL at once; encode one param through its `shape` entry as its state changes. */
export const tableParams = z.object({
	sort,
	page,
	/** Search query. */
	q: param,
	/** Client to filter invoices by. */
	client: z.uuid().optional().catch(undefined),
});

/** Read the table state from URL params. */
export const parseTableParams = (
	params: URLSearchParams | Record<string, string | string[] | undefined>,
) => tableParams.parse(params instanceof URLSearchParams ? Object.fromEntries(params) : params);
