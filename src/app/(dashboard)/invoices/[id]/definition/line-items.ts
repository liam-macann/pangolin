import { type TableCell } from 'pdfmake';
import { type ContentTable } from 'pdfmake/interfaces';

import { formatNumber, pluralize, rateToPercent } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { type Enum } from '@/lib/utils/drizzle';
import { type unitEnum } from '@/db/schema/data/invoices';

import schemes from '@/src/app/ui/color-schemes';

import { type InvoicePrintData } from './index';
import { fontSize, spacing } from './styles';

const singularUnits: Record<Enum<typeof unitEnum>, string> = {
	hours: 'hour',
	items: 'item',
};

export function lineItemsTable({ config, ...invoice }: InvoicePrintData): ContentTable {
	const colors = schemes[config.colorScheme];

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', 70, ...(config.taxRegistration ? [70] : []), 60, 70],
			body: [
				[
					{ text: 'Description', alignment: 'left' },
					'Quantity',
					...(config.taxRegistration ? ['Tax'] : []),
					'Each',
					'Amount',
				],
				...(invoice.items?.map((item): TableCell[] => [
					{
						stack: [
							{ text: item.label },
							...(item.note
								? [{ text: item.note, color: colors.accent, bold: false, marginTop: spacing(0.5) }]
								: []),
						],

						alignment: 'left',
						fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'pnum'],
						verticalAlignment: 'middle',
					},
					{
						text: `${formatNumber(item.quantity, config.locale)} ${item.unit ? pluralize(item.quantity, singularUnits[item.unit], item.unit) : ''}`.trim(),
						bold: false,
						fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'pnum'],
						verticalAlignment: 'middle',
					},
					...(config.taxRegistration
						? ([
								{
									text:
										item.taxes.length > 0
											? item.taxes.map(tax => `${tax.name}(${rateToPercent(tax.rate)}%)`).join(' ')
											: '–',
									bold: false,
									verticalAlignment: 'middle',
								},
							] as const)
						: []),
					{
						text: formatCurrency(item.unitCost, config.currency, config.locale),
						bold: false,
						verticalAlignment: 'middle',
					},
					{
						text: formatCurrency(item.netAmount, config.currency, config.locale),
						verticalAlignment: 'middle',

						// Margin acts similar to minHeight, as smaller padding is allowed with multiline description
						margin: [0, spacing(4)],
					},
				]) || []),
			],
		},
		bold: true,
		alignment: 'right',
		fontSize: fontSize.base,
		fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'tnum', 'lnum'],
		layout: {
			paddingTop: () => spacing(2),
			paddingBottom: () => spacing(2),
			paddingLeft: () => spacing(2),
			paddingRight: () => spacing(2),

			vLineWidth: () => 0,
			hLineWidth: (i: number) => (i <= 1 ? 1 : 0.75),
			hLineColor: (i: number) => (i <= 1 ? colors.black : colors.accent),
			hLineStyle: i => (i <= 1 ? null : { dash: { length: 0.75, space: 1.5 } }),
		},
	};
}
