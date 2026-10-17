import { type SortingState } from '@tanstack/react-table';

import { DEFAULT_INVOICE_SORT, type InvoiceListParams } from '@/lib/hooks/data/invoice';

type SortField = Exclude<NonNullable<InvoiceListParams['sort']>[number], `-${string}`>;

/** Fields the API sorts by. Table columns must share the identifier. */
const fields = ['name', 'issuedAt', 'amount'] as const satisfies SortField[];

const isField = (id: string): id is SortField => fields.some(field => field === id);

/** Encode a table sort as API sort terms, dropping columns the API cannot sort by. */
export const toAPISort = (sorting?: SortingState): InvoiceListParams['sort'] =>
	sorting?.flatMap(({ id, desc }) => (isField(id) ? [desc ? (`-${id}` as const) : id] : []));

/** Decode API sort terms into a table sort, dropping fields the API cannot sort by. */
export const fromAPISort = (terms: readonly string[]): SortingState =>
	terms.flatMap(term => {
		const id = term.replace(/^-/, '');
		return isField(id) ? [{ id, desc: id !== term }] : [];
	});

/** Default table sort, matching the order the API is asked for by default. */
export const DEFAULT_SORT = fromAPISort(DEFAULT_INVOICE_SORT);
