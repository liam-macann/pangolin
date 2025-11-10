import '@/src/app/ui/global.css';

import { MotionConfig } from 'motion/react';
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
		<html lang='en' className={InstrumentSans.variable}>
			<MotionConfig reducedMotion='user'>
				<body className={`bg-background font-sans antialiased`}>
					{children}
					<Toaster />
				</body>
			</MotionConfig>
		</html>
	);
}
