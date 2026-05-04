import { type Enum } from '@/lib/utils/drizzle';
import { type colorEnum } from '@/db/schema';

interface Scheme {
	/** Body text */
	black: `#${string}`;
	/** Accent text */
	accent: `#${string}`;
	/** Toned black */
	heavy: `#${string}`;
	/** Backgrounds */
	gray: `#${string}`;
}

export const schemes: Record<Enum<typeof colorEnum>, Scheme> = {
	grass: {
		black: '#000000',
		accent: '#76ab8d',
		heavy: '#2e995c',
		gray: '#f2f9f7',
	},
	green: {
		black: '#000000',
		accent: '#5EAB92',
		heavy: '#266453',
		gray: '#f2f9f7',
	},
	blue: {
		black: '#000000',
		accent: '#5492a8',
		heavy: '#146c8c',
		gray: '#f2f9f7',
	},
	lavender: {
		black: '#000000',
		accent: '#9e86a3',
		heavy: '#611d6e',
		gray: '#f2f9f7',
	},
	red: {
		black: '#000000',
		accent: '#ad767e',
		heavy: '#701220',
		gray: '#f2f9f7',
	},
	pink: {
		black: '#000000',
		accent: '#b888a6',
		heavy: '#b33484',
		gray: '#f2f9f7',
	},
};

export default schemes;
