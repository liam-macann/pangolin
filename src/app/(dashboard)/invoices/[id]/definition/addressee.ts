import { type ContentTable } from 'pdfmake/interfaces';

import { formatAddress } from '@/lib/utils/address';
import { formatDate } from '@/lib/utils/date';

import schemes from '@/src/styles/color-schemes';

import { type InvoicePrintData } from './index';
import { fontSize, spacing } from './styles';

/** The invoice title, due date, and the client billing details */
export function addresseeTable({ config, ...invoice }: InvoicePrintData): ContentTable {
	const colors = schemes[config.colorScheme];

	return {
		table: {
			widths: ['70%', '30%'],
			body: [
				[
					{ text: invoice.title || '', bold: true },
					{
						text: `Due ${formatDate(invoice.dueAt, config.timezone, { locale: config.locale })}`,
						alignment: 'right',
						bold: true,
					},
				],
				[
					{
						stack: [
							{ text: 'Bill To', bold: true },
							invoice.clientData.name
								? [invoice.clientData.organization ? 'Attn: ' : '', invoice.clientData.name].join(
										'',
									)
								: [],
							invoice.clientData.organization || [],
							invoice.clientData.address
								? [
										{
											text: formatAddress(invoice.clientData.address),
											marginTop: spacing(2),
										},
									]
								: [],
						],
						colSpan: 2,
					},
				],
			],
		},
		fontSize: fontSize.base,
		margin: [0, spacing(8)],
		layout: {
			fillColor: colors.gray,
			paddingTop: i => (i === 0 ? spacing(5) : 0),
			paddingBottom: () => spacing(5),
			paddingLeft: () => spacing(5),
			paddingRight: () => spacing(5),
			hLineWidth: () => 0,
			vLineWidth: () => 0,
		},
	};
}
