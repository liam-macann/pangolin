//
// Vertical alignment is STILL not implemented in pdfmake
//
// https://github.com/bpampuch/pdfmake/issues/74#issuecomment-2145524428
//

import type { CustomTableLayout } from 'pdfmake/interfaces';

type CustomSize = {
	_calcWidth: number;
};

type ContentTableCustom = {
	table: TableCustom;
};

type TableCustom = {
	body: TableCellCustom[][];
	widths: CustomSize[];
};

type TableCellCustom = {
	_margin: [number, number, number, number] | null;
	_inlines?: {
		text: string;
		width: number;
		height: number;
		// dont know type yet
		lineEnd?: unknown;
	}[];
	_offsets?: { total: number };
	stack?: TableCellCustom[];
	ul?: TableCellCustom[];
	table: TableCustom;
	_height?: number;
	_width?: number;
	_span?: boolean;
	colSpan?: number;
	rowSpan?: number;
};

type RowSpan = {
	cell: TableCellCustom;
	rowSpanCount: number;
	cellHeight: number | null;
	maxHeight: number;
	align: Align;
};

export const CenteredLayout: CustomTableLayout = {
	paddingTop: (index, node) => {
		// @ts-expect-error 'TableCell' is not assignable to type 'TableCellCustom'
		applyVerticalAlignment(node, index, 'center', []);
		return 0;
	},

	// defaultBorder: false,
};

export const BottomLayout: CustomTableLayout = {
	paddingTop: (index, node) => {
		// @ts-expect-error 'TableCell' is not assignable to type 'TableCellCustom'
		applyVerticalAlignment(node, index, 'bottom', []);
		return 0;
	},

	// defaultBorder: false,
};

function findInlineHeight(
	cell: TableCellCustom,
	maxWidth: number,
	usedWidth = 0,
): { height: number | null; width: number | null } {
	if (cell._margin) {
		maxWidth = maxWidth - cell._margin[0] - cell._margin[2];
	}
	const calcLines = (inlines: TableCellCustom['_inlines']) => {
		if (!inlines) {
			return {
				height: 0,
				width: 0,
			};
		}
		let currentMaxHeight = 0;
		let lastHadLineEnd = false;
		for (const currentNode of inlines) {
			usedWidth += currentNode.width;
			if (usedWidth > maxWidth || lastHadLineEnd) {
				currentMaxHeight += currentNode.height;
				usedWidth = currentNode.width;
			} else {
				currentMaxHeight = Math.max(currentNode.height, currentMaxHeight);
			}
			lastHadLineEnd = !!currentNode.lineEnd;
		}
		return fillMargin(
			{
				height: currentMaxHeight,
				width: usedWidth,
			},
			cell._margin,
		);
	};

	if (cell._offsets) {
		usedWidth += cell._offsets.total;
	}

	if (cell._inlines?.length) {
		return calcLines(cell._inlines);
	}
	if (cell.stack?.[0]) {
		return fillMargin(
			cell.stack
				.map((item: TableCellCustom) => {
					return findInlineHeight(item, maxWidth);
				})
				.reduce((prev, next) => {
					const prevHeight = prev.height || 0;
					const nextHeight = next.height || 0;
					const prevWidth = prev.width || 0;
					const nextWidth = next.width || 0;
					return {
						height: prevHeight + nextHeight,
						width: Math.max(prevWidth + nextWidth),
					};
				}),
			cell._margin,
		);
	}
	if (cell.ul) {
		return fillMargin(
			cell.ul
				.map(item => {
					return findInlineHeight(item, maxWidth);
				})
				.reduce((prev, next) => {
					const prevHeight = prev.height || 0;
					const nextHeight = next.height || 0;
					const prevWidth = prev.width || 0;
					const nextWidth = next.width || 0;
					return {
						height: prevHeight + nextHeight,
						width: Math.max(prevWidth + nextWidth),
					};
				}),
			cell._margin,
		);
	}
	if (cell.table) {
		let currentMaxHeight = 0;
		for (const currentTableBodies of cell.table.body) {
			const innerTableHeights = currentTableBodies
				.map(val => mapTableBodies(val, maxWidth, usedWidth))
				.filter(isTruthy);
			currentMaxHeight = Math.max(...innerTableHeights, currentMaxHeight);
		}
		return fillMargin(
			{
				height: currentMaxHeight,
				width: usedWidth,
			},
			cell._margin,
		);
	}
	if (cell._height && cell._width) {
		usedWidth += cell._width;
		return fillMargin(
			{
				height: cell._height,
				width: usedWidth,
			},
			cell._margin,
		);
	}

	return fillMargin(
		{
			height: null,
			width: usedWidth,
		},
		cell._margin,
	);
}

function mapTableBodies(
	innerTableCell: TableCellCustom,
	maxWidth: number,
	usedWidth: number,
): number | null {
	const inlineHeight = findInlineHeight(innerTableCell, maxWidth, usedWidth);
	if (inlineHeight.width) {
		usedWidth = inlineHeight.width;
	}
	return inlineHeight.height;
}

function fillMargin(
	obj: { height: number | null; width: number | null },
	margin: [number, number, number, number] | null,
): { height: number | null; width: number | null } {
	// [ts] Margin always null?
	if (margin && obj.height && obj.width) {
		obj.height += margin[1] + margin[3];
		obj.width += margin[0] + margin[2];
	}
	return obj;
}

type Align = 'top' | 'center' | 'bottom' | [number, number];

function isTruthy<T>(value?: T | undefined | null | false): value is T {
	return !!value;
}

function applyVerticalAlignment(
	node: ContentTableCustom,
	rowIndex: number,
	align: Align,
	rowSpanCell: RowSpan[],
) {
	// New default argument
	const allCellHeights = node.table.body[rowIndex]
		.map((innerNode, columnIndex) => {
			if (innerNode._span) return null;
			const calcWidth = [...Array(innerNode.colSpan || 1).keys()].reduce((acc, i) => {
				return acc + node.table.widths?.[columnIndex + i]._calcWidth;
			}, 0);
			const mFindInlineHeight = findInlineHeight(innerNode, calcWidth, 0);
			return mFindInlineHeight.height;
		})
		.filter(isTruthy);
	const maxRowHeight = Math.max(...allCellHeights.filter(isTruthy));
	node.table.body[rowIndex].forEach((cell, ci) => {
		// rowSpan
		if (cell.rowSpan) {
			rowSpanCell.push({
				cell,
				rowSpanCount: cell.rowSpan,
				cellHeight: allCellHeights[ci],
				maxHeight: 0,
				align,
			});
			return;
		}
		if (allCellHeights[ci] && maxRowHeight > allCellHeights[ci]) {
			const cellAlign = align;

			const topMargin = (() => {
				if (cellAlign === 'bottom') return maxRowHeight - allCellHeights[ci];
				return (maxRowHeight - allCellHeights[ci]) / 2;
			})();
			if (topMargin) {
				if (cell._margin) {
					cell._margin[1] += topMargin;
				} else {
					cell._margin = [0, topMargin, 0, 0];
				}
			}
		}
	});

	function updateRowSpanCell(rowHeight: number, rowSpanCell: RowSpan[]) {
		for (let i = rowSpanCell.length - 1; i >= 0; i--) {
			const rowCell = rowSpanCell[i];
			rowCell.maxHeight = rowCell.maxHeight + rowHeight;
			const { maxHeight, cellHeight, align, cell } = rowCell;
			rowCell.rowSpanCount = rowCell.rowSpanCount - 1;
			if (!rowCell.rowSpanCount) {
				if (cellHeight && maxHeight > cellHeight) {
					const topMargin = (() => {
						if (align === 'bottom') return maxHeight - cellHeight;
						if (align === 'center') return (maxHeight - cellHeight) / 2;
						return undefined;
					})();

					if (topMargin) {
						if (cell._margin) {
							cell._margin[1] = cell._margin[1] + topMargin;
						} else {
							cell._margin = [0, topMargin, 0, 0];
						}
					}
				}
				rowSpanCell.splice(i, 1);
			}
		}
	}

	updateRowSpanCell(maxRowHeight, rowSpanCell);

	if (rowSpanCell.length > 0) {
		applyVerticalAlignment(node, rowIndex + 1, align, rowSpanCell);
	}
}
