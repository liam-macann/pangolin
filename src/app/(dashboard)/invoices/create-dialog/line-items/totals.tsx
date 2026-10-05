import { type Control, useWatch } from 'react-hook-form';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { intlNumber } from '@/lib/zod';

import { type LineItemsConfig, type LineItemsFormValues } from './types';

function calculateTotals(
	items: LineItemsFormValues['items'],
	configuredTaxes: LineItemsConfig['taxes'],
) {
	const taxesById = new Map(configuredTaxes.map(tax => [tax.id, tax]));

	const { subtotal, taxTotal } = items.reduce(
		(totals, item) => {
			try {
				const unitCost = intlNumber().parse(item.unitCost);
				const quantity = intlNumber().parse(item.quantity);
				const lineTotal = unitCost * quantity;
				const taxRate = [...item.taxes].reduce(
					(totalRate, taxId) => totalRate + Number(taxesById.get(taxId)?.rate ?? 0),
					0,
				);

				return {
					subtotal: totals.subtotal + lineTotal,
					taxTotal: totals.taxTotal + lineTotal * taxRate,
				};
			} catch {
				return totals;
			}
		},
		{ subtotal: 0, taxTotal: 0 },
	);

	return { subtotal, total: subtotal + taxTotal };
}

export function InvoiceTotals({
	control,
	config,
	className,
}: {
	control: Control<LineItemsFormValues>;
	config: LineItemsConfig;
	className?: string;
}) {
	const items = useWatch({ name: 'items', control }) ?? [];
	const { subtotal, total } = calculateTotals(items, config.taxes);

	return (
		<table className={cn('block w-0 min-w-0 max-w-min shrink grow table-auto text-sm', className)}>
			<tbody className='contents'>
				<tr className='flex items-baseline justify-between gap-4 text-muted-foreground *:pb-1.5'>
					<td>Subtotal</td>
					<td className='truncate text-right tabular-nums'>
						{formatCurrency(subtotal, config.currency, config.locale)}
					</td>
				</tr>
			</tbody>
			<tfoot className='contents'>
				<tr className='flex items-baseline justify-between gap-4 border-t font-semibold *:pt-1'>
					<td>Total</td>
					<td className='truncate text-right text-lg tabular-nums'>
						{formatCurrency(total, config.currency, config.locale)}
					</td>
				</tr>
			</tfoot>
		</table>
	);
}
