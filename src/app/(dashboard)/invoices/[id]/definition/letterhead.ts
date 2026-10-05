import { type ContentTable } from 'pdfmake/interfaces';

import { formatAddress } from '@/lib/utils/address';

import schemes from '@/src/styles/color-schemes';

import { type InvoicePrintData } from './index';
import { spacing } from './styles';

/** The trading name, header line, and contact details block at the top of the invoice */
export function letterheadTable({ config }: InvoicePrintData): ContentTable {
	const colors = schemes[config.colorScheme];

	return {
		style: 'footer',
		marginTop: -spacing(4),
		table: {
			widths: ['60%', '40%'],
			body: [
				[
					'',
					{
						alignment: 'right',
						text: config.tradingName,
						bold: true,
						color: colors.heavy,
						margin: [0, 0, 0, spacing(4)],
					},
				],
				[
					{
						text: config.header ?? '',
						marginLeft: spacing(5),
						marginRight: spacing(5),
					},
					{
						alignment: 'right',
						stack: [
							{ stack: [...(config.tradingNumber || [])] },

							config.email ? { text: config.email } : [],
							config.phone ? { text: config.phone } : [],

							config.address
								? [
										{
											text: formatAddress(config.address),
											marginTop: spacing(4),
										},
									]
								: [],
						],
					},
				],
			],
		},
		layout: {
			paddingTop: () => 0,
			paddingBottom: () => 0,
			paddingLeft: () => 0,
			paddingRight: () => 0,
			hLineWidth: () => 0,
			vLineWidth: () => 0,
		},
	};
}
