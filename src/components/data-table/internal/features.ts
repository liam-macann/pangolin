import {
	columnFilteringFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	filterFn_equals,
	globalFilteringFeature,
	metaHelper,
	rowPaginationFeature,
	rowSortingFeature,
	tableFeatures,
} from '@tanstack/react-table';

export const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	rowSortingFeature,
	rowPaginationFeature,
	columnVisibilityFeature,
	columnSizingFeature,

	// Sort state is applied by the API, so rows have no sorted row model
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),

	filterFns: { equals: filterFn_equals },

	columnMeta: metaHelper<{ className?: string }>(),
});

export type DataTableFeatures = typeof features;
