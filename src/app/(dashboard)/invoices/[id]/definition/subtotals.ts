import { type TableCell } from 'pdfmake';
import { type ContentColumns } from 'pdfmake/interfaces';

import { formatCurrency } from '@/lib/utils/currencies';

import schemes from '@/src/app/ui/color-schemes';

import { type InvoicePrintData } from './index';
import { fontSize, spacing } from './styles';

export function subtotalTable({ config, ...invoice }: InvoicePrintData): ContentColumns {
	const colors = schemes[config.colorScheme];

	return {
		marginTop: spacing(6),
		columnGap: spacing(2),
		columns: [
			{
				stack: config.taxRegistration
					? []
					: [...(invoice.tax.map(t => `${t.name} not applicable`) || 'Tax not applicable')],
				color: colors.accent,
				fontSize: fontSize.base,
				marginLeft: spacing(2),
			},
			{
				width: 'auto',
				unbreakable: true,
				table: {
					dontBreakRows: true,
					widths: [80, 100],
					body: [
						[
							{ text: 'Subtotal', verticalAlignment: 'bottom' },
							{
								text: formatCurrency(invoice.netTotal, config.currency, config.locale),
								alignment: 'right',
								verticalAlignment: 'bottom',
							},
						],
						...invoice.tax.map((tax, i): [TableCell, TableCell] => [
							{
								text: `${tax.name} incl.`,
								color: colors.accent,
								verticalAlignment: 'bottom',

								// Margin before 'Total' line
								marginBottom: i === invoice.tax.length - 1 ? spacing(1.5) : 0,
							},
							{
								text: formatCurrency(tax.contribution, config.currency, config.locale),
								alignment: 'right',
								color: colors.accent,
								verticalAlignment: 'bottom',

								// Margin before 'Total' line
								marginBottom: i === invoice.tax.length - 1 ? spacing(1.5) : 0,
							},
						]),
						[
							{ text: 'Total', bold: true, verticalAlignment: 'bottom' },
							{
								text: formatCurrency(invoice.grossTotal, config.currency, config.locale),
								alignment: 'right',
								bold: true,
								fontSize: fontSize.lg,
								marginTop: spacing(3),
								verticalAlignment: 'bottom',
							},
						],
					],
				},
				fontSize: fontSize.base,
				fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'tnum', 'lnum'],
				layout: {
					paddingTop: () => spacing(0),
					paddingBottom: () => spacing(2),
					paddingLeft: () => spacing(2),
					paddingRight: () => spacing(2),
					vLineWidth: () => 0,
					hLineWidth: (i, node) => (i + 1 === node.table.body.length ? 1 : 0),
					hLineColor: () => colors.accent,
				},
			},
		],
	};
}
