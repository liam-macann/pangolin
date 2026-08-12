import { type ToastManagerEvent } from '@base-ui/react/toast';
import { describe, expect, test } from 'vitest';

import { toast } from './toast';

/** Captures the next toast event */
function captureToastEvent() {
	return new Promise<ToastManagerEvent>(resolve => {
		const unsubscribe = toast[' subscribe'](event => {
			unsubscribe();
			resolve(event);
		});
	});
}

describe('toast()', () => {
	test('Bare string becomes title, with no type set', async () => {
		const [event] = await Promise.all([captureToastEvent(), toast('Client created')]);

		expect(event.action).toBe('add');
		expect(event.options).toMatchObject({ title: 'Client created', type: undefined });
	});
});

// Tests the withType wrapper, which binds a ToastType and shims a Sonner-like API
describe('toast.<type>()', () => {
	test('Bare string becomes title', async () => {
		const [event] = await Promise.all([captureToastEvent(), toast.success('Client created')]);

		expect(event.action).toBe('add');
		expect(event.options).toMatchObject({ type: 'success', title: 'Client created' });
	});

	test('Bare element becomes title', async () => {
		const element = <b>Hello</b>;
		const [event] = await Promise.all([captureToastEvent(), toast.info(element)]);

		expect(event.options).toMatchObject({ type: 'info', title: element });
	});

	test('Options object is forwarded, not treated as a title', async () => {
		const [event] = await Promise.all([
			captureToastEvent(),
			toast.error({ title: 'Failed to archive client', id: 'archive-1' }),
		]);

		expect(event.options).toMatchObject({
			type: 'error',
			title: 'Failed to archive client',
			id: 'archive-1',
		});
	});
});

describe('toast.promise()', () => {
	test('Bare strings resolve to title, not description', async () => {
		const [event] = await Promise.all([
			captureToastEvent(),
			toast.promise(Promise.resolve('ok'), {
				loading: 'Creating…',
				success: 'Created',
				error: 'Failed',
			}),
		]);

		expect(event.action).toBe('promise');
		expect(event.options.loading).toEqual({ title: 'Creating…' });
		expect(event.options.success('ok')).toEqual({ title: 'Created' });
		expect(event.options.error(new Error('boom'))).toEqual({ title: 'Failed' });
	});

	test('Resolves without recursing infinitely', async () => {
		const promise = toast.promise(Promise.resolve(42), {
			loading: 'Loading…',
			success: 'Done',
			error: 'Failed',
		});

		await expect(promise).resolves.toBe(42);
	});
});
