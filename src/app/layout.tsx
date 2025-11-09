import '@/src/app/ui/global.css';

import type { Metadata } from 'next';
import { InstrumentSans } from '@/src/app/ui/fonts';
import { Toaster } from '@/ui/sonner';

export const metadata: Metadata = {
	title: {
		template: '%s ∙ Invoicer',
		default: 'Invoicer',
	},
	description: 'A lightweight invoicing application for contract work',
	// metadataBase: new URL(''),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' className={InstrumentSans.className}>
			<body className={`bg-background font-sans antialiased`}>
				{children}
				<Toaster />
			</body>
		</html>
	);
}
