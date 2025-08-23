import '@/src/app/ui/global.css';

import type { Metadata } from 'next';
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
		<html lang='en'>
			<body className={`font-sans antialiased`}>
				{children}
				<Toaster />
			</body>
		</html>
	);
}
