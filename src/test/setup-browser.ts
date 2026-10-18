import { vi } from 'vitest';
import { configure } from 'vitest-browser-react/pure';

vi.mock('next/link');

configure({
	reactStrictMode: true,
});
