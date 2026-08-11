import { getCountryData, type TCountryCode } from 'countries-list';
import { type Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSession } from '@/auth';

import { type Geo, Wizard } from './ui';

export const metadata: Metadata = { title: 'Welcome' };

export const instant = false;

export default async function Page() {
	const session = await getSession();
	if (!session) redirect('/auth/login');

	const headerList = await headers();
	const country = headerList.get('x-vercel-ip-country');

	const geo: Geo = {
		country,
		currency: country && getCountryData(country as TCountryCode)?.currency[0],
		timezone: headerList.get('x-vercel-ip-timezone'),
	};

	return <Wizard session={session} geo={geo} />;
}
