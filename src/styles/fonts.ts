import localFont from 'next/font/local';

export const InstrumentSans = localFont({
	src: [
		{ path: '../fonts/InstrumentSans-VariableFont_wdth,wght.ttf', style: 'normal' },
		{ path: '../fonts/InstrumentSans-Italic-VariableFont_wdth,wght.ttf', style: 'italic' },
	],
	variable: '--instrument-sans',
	weight: '400 700',
});
