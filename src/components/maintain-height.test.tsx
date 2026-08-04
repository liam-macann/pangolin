import { type ComponentProps } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { MaintainHeight } from './maintain-height';

const VIEWPORT_WIDTH = 800;

const rect = (top: number, height: number) => new DOMRect(0, top, 100, height);

const renderMaintainHeight = async (
	children: ComponentProps<typeof MaintainHeight>['children'] = <p>content</p>,
	style?: ComponentProps<typeof MaintainHeight>['style'],
) => {
	const result = await render(<MaintainHeight style={style}>{children}</MaintainHeight>);

	const root = result.container.firstElementChild;
	expect(root).toBeInstanceOf(HTMLElement);

	return { ...result, root: root as HTMLElement };
};

const mockViewport = async ({
	top,
	height,
	innerHeight = 300,
}: {
	/** Distance (px) from MaintainHeight top edge to the top of the viewport */
	top: number;
	/** The unclipped content height (px) of MaintainHeight */
	height: number;
	/** The real viewport height (px) */
	innerHeight?: number;
}) => {
	const getBoundingClientRect = vi
		.spyOn(Element.prototype, 'getBoundingClientRect')
		.mockReturnValue(rect(top, height));

	await page.viewport(VIEWPORT_WIDTH, innerHeight);

	return getBoundingClientRect;
};

afterEach(() => {
	vi.restoreAllMocks();
	window.scrollTo(0, 0);
});

test('Renders its children', async () => {
	const { container } = await render(
		<MaintainHeight>
			<p>content</p>
		</MaintainHeight>,
	);

	await expect.element(container).toHaveTextContent('content');
});

test('Uses element height when it fits within the viewport', async () => {
	await mockViewport({ top: 50, height: 241, innerHeight: 300 });
	const { root } = await renderMaintainHeight();
	await expect.element(root).toHaveStyle('min-height: 241px');
});

test('Clips minimum height to the remaining viewport space', async () => {
	await mockViewport({ top: 100, height: 500, innerHeight: 300 });
	const { root } = await renderMaintainHeight();
	await expect.element(root).toHaveStyle(`min-height: ${300 - 100}px`);
});

test('Produces no minimum height when the element is entirely below the viewport', async () => {
	await mockViewport({ top: 400, height: 200, innerHeight: 300 });
	const { root } = await renderMaintainHeight();
	await expect.element(root).toHaveStyle('min-height: 0px');
});

/** The expansion target: viewport height for resize, document scroll position for scrollend. */
const EXPANSION_SCROLL_POSITION = 500;

/** At root top 300px, a 350px viewport leaves exactly 50px visible after resize. */
const RESIZE_SHRINK_VIEWPORT = 350;

/** At document position 1000px, scrollY 250px places the root at 750px in an 800px viewport. */
const SCROLLEND_SHRINK_POSITION = 250;

describe.for([
	['resize', (height: number) => page.viewport(VIEWPORT_WIDTH, height), RESIZE_SHRINK_VIEWPORT],
	['scrollend', async (top: number) => window.scrollTo(0, top), SCROLLEND_SHRINK_POSITION],
] as const)('%s event', ([, triggerEvent, shrinkTarget]) => {
	test('Expands the minimum height to match taller content', async () => {
		await page.viewport(VIEWPORT_WIDTH, 300);

		const { root, rerender } = await renderMaintainHeight(<div style={{ height: 100 }} />, {
			marginBottom: 400,
		});
		await expect.element(root).toHaveStyle('min-height: 100px');

		await rerender(
			<MaintainHeight style={{ marginBottom: 400 }}>
				<div style={{ height: 400 }} />
			</MaintainHeight>,
		);

		// The content has grown, but nothing has recomputed the reserved height yet
		await expect.element(root).toHaveStyle('min-height: 100px');

		await triggerEvent(EXPANSION_SCROLL_POSITION);
		await expect.element(root).toHaveStyle('min-height: 400px');
	});

	test('Shrinks the minimum height when excess height exits the viewport', async () => {
		await page.viewport(VIEWPORT_WIDTH, 800);

		const { root, rerender } = await renderMaintainHeight(<div style={{ height: 400 }} />, {
			marginBottom: 400,
			marginTop: 1000,
		});

		window.scrollTo(0, 700);
		await expect.element(root).toHaveStyle('min-height: 400px');

		await rerender(
			<MaintainHeight style={{ marginBottom: 400, marginTop: 1000 }}>
				<div style={{ height: 50 }} />
			</MaintainHeight>,
		);

		// The content has shrunk, but the reserved height stays pinned until scrolling settles
		await expect.element(root).toHaveStyle('min-height: 400px');

		await triggerEvent(shrinkTarget);
		await expect.element(root).toHaveStyle('min-height: 50px');
	});
});
