import { type BrowserCommand } from 'vitest/node';

declare module 'vitest/browser' {
	interface BrowserCommands {
		/** Simulates a drag-and-drop operation, calling rAF to force a frame to elapse
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
> = async ({ page, iframe }, sourceSelector, targetSelector) => {
	const source = await iframe.locator(sourceSelector).boundingBox();
	const target = await iframe.locator(targetSelector).boundingBox();
	if (!source || !target) throw new Error('dragWithAnimation: could not locate element');

	await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
	await page.evaluate(
		() =>
			new Promise<void>(resolve =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	await page.mouse.up();
};
