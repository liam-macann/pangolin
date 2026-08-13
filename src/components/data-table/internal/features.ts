import {
	columnFilteringFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_equals,
	globalFilteringFeature,
	metaHelper,
	rowPaginationFeature,
	rowSortingFeature,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
} from '@tanstack/react-table';

export const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	rowSortingFeature,
	rowPaginationFeature,
	columnVisibilityFeature,
	columnSizingFeature,

	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),

	filterFns: { equals: filterFn_equals },
	sortFns: { datetime: sortFn_datetime, text: sortFn_text },

	columnMeta: metaHelper<{ className?: string }>(),
});

export type DataTableFeatures = typeof features;
