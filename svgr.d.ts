declare module '*.svg' {
	import { type FC, type SVGProps } from 'react';

	const content: FC<SVGProps<SVGElement>>;
	export default content;
}

declare module '*.svg?url' {
	// biome-ignore lint/suspicious/noExplicitAny: Replicates default behaviour
	const content: any;
	export default content;
}
