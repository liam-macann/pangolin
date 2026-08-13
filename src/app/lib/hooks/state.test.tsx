import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { useControllableState } from './state';

describe('useControllableState', () => {
	function Harness({ value, onChange }: { value?: number; onChange?: (value: number) => void }) {
		const [current, setCurrent] = useControllableState({ value, defaultValue: 2, onChange });

		return (
			<>
				<output aria-label='value'>{current}</output>
				<button type='button' onClick={() => setCurrent(5)}>
					Set value
				</button>
				<button type='button' onClick={() => setCurrent(previous => previous + 1)}>
					Increment
				</button>
			</>
		);
	}

	test('Updates its internal value when uncontrolled', async () => {
		const screen = await render(<Harness />);

		await userEvent.click(screen.getByRole('button', { name: 'Set value' }));
		expect(screen.getByLabelText('value')).toHaveTextContent('5');

		await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
		expect(screen.getByLabelText('value')).toHaveTextContent('6');
	});

	test('Reports uncontrolled updates to callback', async () => {
		const onChange = vi.fn();
		const screen = await render(<Harness onChange={onChange} />);

		await userEvent.click(screen.getByRole('button', { name: 'Increment' }));

		expect(onChange).toHaveBeenCalledWith(3);
	});

	test('Reports updates to callback without overriding a controlled value', async () => {
		const onChange = vi.fn();
		const screen = await render(<Harness value={10} onChange={onChange} />);

		await userEvent.click(screen.getByRole('button', { name: 'Increment' }));

		expect(onChange).toHaveBeenCalledWith(11);
		// The controlled value={10} has not changed
		expect(screen.getByLabelText('value')).toHaveTextContent('10');
	});

	test('Renders the value supplied by the parent after an update', async () => {
		function ControlledHarness() {
			const [value, setValue] = useState(10);
			return <Harness value={value} onChange={setValue} />;
		}

		const screen = await render(<ControlledHarness />);
		await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
		expect(screen.getByLabelText('value')).toHaveTextContent('11');
	});

	test('Warns when changing between uncontrolled and controlled', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const screen = await render(<Harness value={undefined} />);

		await screen.rerender(<Harness value={10} />);
		expect(error).toHaveBeenCalledWith(expect.stringContaining('from uncontrolled to controlled'));
		error.mockClear();

		await screen.rerender(<Harness value={undefined} />);
		expect(error).toHaveBeenCalledWith(expect.stringContaining('from controlled to uncontrolled'));
		error.mockClear();

		error.mockRestore();
	});
});
