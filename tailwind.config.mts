// tailwind.config.js

import radix from '@radix-ui/colors';
import { type Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * Ensures that all objects in a tuple are mutually assignable
 *
 * @template T - A arbitrary-length tuple of objects `[object, object, …]`
 */
export type MutuallyAssignable<T extends [object, ...object[]]> = T[number] extends T[0]
	? T[0] extends T[number]
		? T
		: never
	: never;

const defineColors = <T extends Record<string, [object, object, object]>>(
	col: { [K in keyof T]: MutuallyAssignable<T[K]> },
) => col;

/**
 * Color definitions from Radix.
 * Each entry is a tuple of [lightColor, darkColor, hintColor].
 * Hint is light in HEX format.
 */
const colors: Record<string, [Color, ...Color[]]> = defineColors({
	gray: [radix.sandP3, radix.sandDarkP3, radix.sand],
	'gray-a': [radix.sandP3A, radix.sandDarkP3A, radix.sandA],
	red: [radix.redP3, radix.redDarkP3, radix.red],
	green: [radix.greenP3, radix.greenDarkP3, radix.green],
	blue: [radix.indigoP3, radix.indigoDarkP3, radix.indigo],
	orange: [radix.orangeP3, radix.orangeDarkP3, radix.orange],
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
 * @remarks Includes a fallback value for editor hints
 */
const lightDark = () =>
	flattenScheme(
		({ values: [light, dark, hint] }) => `light-dark(${light}, ${dark}) var(--tw-hint, ${hint})`,
	);

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
					'--tw-hint': ' ',
				},
			});
		}),
	],
};

export default config;
