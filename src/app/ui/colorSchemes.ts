import type { colorEnum } from '@/db/schema';
import type { Enum } from '@/lib/utils/drizzle';

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
	green: {
		black: '#000000',
		accent: '#5EAB92',
		heavy: '#266453',
		gray: '#f2f9f7',
	},
	blue: {
		black: '#000000',
		accent: '#5da1ba',
		heavy: '#146c8c',
		gray: '#f2f9f7',
	},
	lavender: {
		black: '#000000',
		accent: '#9b67a6',
		heavy: '#611d6e',
		gray: '#f2f9f7',
	},
	red: {
		black: '#000000',
		accent: '#b36873',
		heavy: '#701220',
		gray: '#f2f9f7',
	},
};

export default schemes;
