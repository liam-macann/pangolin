export const fontSize = {
	base: 10,
	/** Headers and footers */
	sm: 11,
	/** Headings */
	lg: 14,
};

/** Convert pixels to points */
const px = (v: number) => (v / 4) * 3;

export const spacing = (i: number) => px(4 * i);

export const footerStyles = {
	border: 0,
	fontSize: fontSize.sm,
	lineHeight: 1,
};

// Yes, this is a magic number multiplier. Exact `1` failed, despite lineHeight being set on footer styles.
// Tested between 1–50 lines
const footerLineHeight = (n: number) => n * footerStyles.fontSize * footerStyles.lineHeight * 1.22;

export const footerMargins = {
	/** Applied as padding to table layout. The gutter between footer end and page end. */
	marginBottom: spacing(12),

	/** Prevent overflow due to text being too close to padding. Magic number. */
	safeAreaTop: footerLineHeight(1),

	/** Prevent overflow due to text being too close to padding. Magic number. */
	safeAreaBottom: footerLineHeight(1),
};

export const footerHeight = (lines: number) => {
	// Lines incremented for safe area
	const textHeight = footerLineHeight(lines);

	const tablePadding = 2; // Default pdfmake top-padding

	return (
		textHeight +
		tablePadding +
		footerStyles.border * 2 +
		footerMargins.marginBottom +
		footerMargins.safeAreaTop +
		footerMargins.safeAreaBottom
	);
};
