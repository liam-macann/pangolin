// tailwind.config.js

import radix from '@radix-ui/colors';
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import type { AllSameKeys } from '@/lib/utils';

const defineColors = <T extends Record<string, [object, object, object]>>(
	col: { [K in keyof T]: AllSameKeys<T[K]> },
) => col;

/**
 * Color definitions from Radix.
 * Each entry is a tuple of [lightColor, darkColor, hintColor].
 * Hint is light in HEX format.
 */
const colors: Record<string, [Color, ...Color[]]> = defineColors({
	primary: [radix.sandP3, radix.sandDarkP3, radix.sand],
	red: [radix.redP3, radix.redDarkP3, radix.red],
});

type Color = Record<string, string>;
type ColorMap = { [key: string]: Color };

/**
 * A utility to iterate over all scheme pairs [light, dark] and their shades.
 *
 */
const flattenScheme = (
	value: (props: {
		/** The generated utility label, keyed in color definitions */
		label: string;
		/** The numerical scale for the color: eg. 12 */
		scale: string;
		/** Tuple of [light, dark, hint] color scheme values */
		values: [string, string, string];
	}) => string,
): ColorMap =>
	Object.fromEntries(
		Object.entries(colors).map(([label, schemes]) => {
			const color: Color = Object.fromEntries(
				// Schemes are enforced to have the same keys (e.g., 'sand1', 'sand2')
				Object.keys(schemes[0]).map(radixKey => {
					// Extract scale from key: eg. sand12 → 12
					// This ensures the array order does not affect the color mapping
					const scale = radixKey.replace(/[^0-9]/g, '');

					return [
						scale,
						value({
							label,
							scale,
							values: schemes.map(scheme => scheme[radixKey]) as [string, string, string],
						}),
					];
				}),
			);

			return [label, color];
		}),
	);

/**
 * Generates a set of single color values to alternate between light and dark schemes
 *
 * {@link https://stackoverflow.com/questions/79739829/how-can-i-safely-introduce-the-use-of-light-dark-without-increasing-the-mini/79739830#79739830 | Creates a light-dark() alternative without sacrificing browser support}
 *
 * @returns
 * ```ts
 * {
 *  sand: { [1-12]: var(--tw-light, VALUE) var(--tw-dark, VALUE) },
 *  slate: { [1-12]: var(--tw-light, VALUE) var(--tw-dark, VALUE) },
 *  […]
 * }
 * ```
 *
 * @remarks
 *
 * In your `global.css`, include:
 * ```css
 * :root {
 *  `@variant dark {
 *    color-scheme: dark;
 *    --tw-light: ;
 *    --tw-dark: initial;
 *  }
 * }
 *
 * Fallback value for editor hints
 */
const lightDark = () =>
	flattenScheme(
		({ values: [light, dark, hint] }) =>
			`var(--tw-light, ${light}) var(--tw-dark, ${dark}) var(--tw-hint, ${hint})`,
	);

/** Generates utility classes that reference the `@layer base` CSS variables.
 *
 * Directly providing the color values allows for editor hints. */
const _referenceColorVariables = () =>
	flattenScheme(({ label, scale }) => `var(--color-${label}-${scale})`);

const generateColorVariables = (scheme: ColorMap) =>
	Object.fromEntries(
		Object.entries(scheme).flatMap(([label, color]) =>
			Object.entries(color).map(([scale, value]) => [`--color-${label}-${scale}`, value]),
		),
	);

export const config: Config = {
	theme: {
		extend: {
			colors: lightDark(),
		},
	},
	plugins: [
		plugin(({ addBase }) => {
			addBase({
				':root': {
					...generateColorVariables(lightDark()),
					colorScheme: 'light',
					'--tw-hint': ' ',
					'--tw-light': 'initial',
					'--tw-dark': '',
				},
			});
		}),
	],
};

export default config;
