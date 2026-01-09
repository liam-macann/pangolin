'use client';

import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { Spinner } from '@/ui/spinner';

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			toastOptions={{ className: 'font-sans !rounded-md' }}
			position='bottom-center'
			className='toaster group'
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
				} as React.CSSProperties
			}
			gap={12}
			icons={{
				success: <CheckCircleIcon className='size-5' weight='fill' />,
				info: <InfoIcon className='size-5' weight='fill' />,
				warning: <WarningIcon className='size-5' weight='fill' />,
				error: <WarningCircleIcon className='size-5' weight='fill' />,
				loading: <Spinner className='size-5 scale-90' />,
			}}
			{...props}
		/>
	);
};

export { Toaster };
