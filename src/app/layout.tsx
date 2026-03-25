import '@/src/app/ui/global.css';

import { MotionConfig } from 'motion/react';
import { type Metadata } from 'next';
import { Provider } from 'react-wrap-balancer';
import { SWRConfig } from 'swr';

import { Toaster } from '@/ui/sonner';
import { TooltipProvider } from '@/ui/tooltip';

import { InstrumentSans } from '@/src/app/ui/fonts';

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
			<TooltipProvider>
				<SWRConfig>
					<MotionConfig reducedMotion='user'>
						<body className={`bg-background font-sans antialiased`}>
							<Provider>
								{children}
								<Toaster />
							</Provider>
						</body>
					</MotionConfig>
				</SWRConfig>
			</TooltipProvider>
		</html>
	);
}
