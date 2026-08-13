import { type BrowserCommand } from 'vitest/node';

declare module 'vitest/browser' {
	interface BrowserCommands {
		/** Simulates a drag-and-drop operation, moving the pointer across animation frames
		 * (unlike `userEvent.dragAndDrop()` which is instant)
		 *
		 * @param sourceSelector - The selector of the source element to drag
		 * @param targetSelector - The selector of the target element to drop onto
		 */
		dragWithAnimation: (sourceSelector: string, targetSelector: string) => Promise<void>;
	}
}

export const dragWithAnimation: BrowserCommand<
	[sourceSelector: string, targetSelector: string]
> = async ({ page, iframe, frame }, sourceSelector, targetSelector) => {
	const source = await iframe.locator(sourceSelector).boundingBox();
	const target = await iframe.locator(targetSelector).boundingBox();
	if (!source || !target) throw new Error('dragWithAnimation: could not locate element');

	const testFrame = await frame();

	/** Advances a single rAF */
	const advanceAnimationFrame = () =>
		testFrame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));

	const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
	const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

	await page.mouse.move(start.x, start.y);
	await page.mouse.down();

	const steps = 5;
	for (let step = 1; step <= steps; step++) {
		const progress = step / steps;
		await page.mouse.move(
			start.x + (end.x - start.x) * progress,
			start.y + (end.y - start.y) * progress,
		);
		await advanceAnimationFrame();
	}

	await advanceAnimationFrame();
	await page.mouse.up();
};
