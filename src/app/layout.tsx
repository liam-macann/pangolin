import '@/src/app/ui/global.css';

import { MotionConfig } from 'motion/react';
import { type Metadata } from 'next';
import { Provider } from 'react-wrap-balancer';

import { QueryProvider } from '@/lib/hooks/data/helper';
import { cn } from '@/lib/utils';

import { DisableThemeTransitions } from '@/components/disable-theme-transitions';
import { Toaster } from '@/ui/toast';
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
		<html
			lang='en'
			data-scroll-behavior='smooth'
			className={cn(InstrumentSans.variable, 'motion-safe:scroll-smooth')}
		>
			<TooltipProvider>
				<QueryProvider>
					<MotionConfig reducedMotion='user'>
						<body className='bg-background font-sans antialiased'>
							<DisableThemeTransitions />
							<Provider>
								{children}
								<Toaster timeout={4000} />
							</Provider>
						</body>
					</MotionConfig>
				</QueryProvider>
			</TooltipProvider>
		</html>
	);
}
