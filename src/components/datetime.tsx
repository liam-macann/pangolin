import { type TZDate } from '@date-fns/tz';
import { formatISO } from 'date-fns';
import { type ComponentProps } from 'react';

import { type FormatDateOptions, formatDate } from '@/lib/utils/date';

export function Datetime({
	date,
	locale,
	options,
	...props
}: Omit<ComponentProps<'time'>, 'dateTime' | 'children'> & {
	date: TZDate;
	locale: string;
	options?: Omit<FormatDateOptions, 'locale'>;
}) {
	const includeTime = options?.time ?? false;
	const timezone = date.timeZone;
	if (!timezone) throw new Error('Timezone is required. Ensure date is a TZDate');

	return (
		<time
			dateTime={formatISO(date, { representation: includeTime ? 'complete' : 'date' })}
			{...props}
		>
			{formatDate(date.toISOString(), timezone, { ...options, locale, time: includeTime })}
		</time>
	);
}
