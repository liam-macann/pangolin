import { TZDate } from '@date-fns/tz';
import { type DynamicContent } from 'pdfmake/interfaces';

import { formatDate } from '@/lib/utils/date';

import { type InvoicePrintData } from './index';
import { footerMargins, footerStyles, spacing } from './styles';

/** The page footer: payment details on the left, issue date on the right.
 *  Footer `pageMargins` must match the document page margins, so that the footer aligns with body content. */
export function documentFooter(
	invoice: InvoicePrintData,
	pageMargins: [number, number, number, number],
): DynamicContent {
	const footerLeftContent = invoice.config.paymentDetails || [];

	return () => {
		return {
			style: 'footer',
			margin: [pageMargins[0], 0, pageMargins[2], 0],
			unbreakable: true,
			layout: {
				hLineWidth: () => footerStyles.border,
				vLineWidth: () => footerStyles.border,
				paddingBottom: () => footerMargins.marginBottom,
				paddingLeft: i => (i === 0 ? 0 : spacing(1)),
				paddingRight: i => (i > 0 ? 0 : spacing(1)),
			},
			table: {
				style: 'footer',
				widths: ['*', 0, '*'],
				dontBreakRows: true,
				body: [
					[
						{ stack: footerLeftContent, verticalAlignment: 'bottom' },
						{
							stack: [' '],
							opacity: 0,
							fontSize: 0.1,
							margin: [
								0,
								pageMargins[3] - footerMargins.marginBottom - footerMargins.safeAreaBottom,
								0,
								0,
							],
							verticalAlignment: 'bottom',
						},
						{
							text: `Issued ${formatDate(new TZDate(invoice.issuedAt, invoice.config.timezone), { locale: invoice.config.locale })}`,
							alignment: 'right',
							verticalAlignment: 'bottom',
						},
					],
				],
			},
		};
	};
}
