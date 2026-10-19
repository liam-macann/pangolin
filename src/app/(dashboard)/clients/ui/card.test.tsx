import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { type Client } from '@/api/dto/client';

import { Card } from './card';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

// Mutation hooks call server actions, which import the database.
vi.mock('@/lib/actions/client', () => ({
	updateClientFavorite: vi.fn(),
	updateClientDeleted: vi.fn(),
}));
vi.mock('@/lib/hooks', () => ({ useClientMutation: () => ({ mutate }) }));

const client: Client = {
	id: crypto.randomUUID(),
	isFavorite: false,
	isDeleted: false,
	invoiceCount: 0,
	data: {
		version: crypto.randomUUID(),
		name: 'Acme',
		organization: null,
		email: 'billing@acme.example',
		notes: null,
		address: null,
		formattedAddress: null,
	},
};

beforeEach(() => (MotionGlobalConfig.skipAnimations = true));
afterEach(() => (MotionGlobalConfig.skipAnimations = false));

test('Blocks adding a favorite at the limit, and re-enables once a slot opens', async () => {
	const screen = await render(<Card client={client} favoriteLimitReached />);
	const star = screen.getByRole('button', { name: 'Favourite' });
	await expect.element(star).toBeDisabled();

	await screen.rerender(<Card client={client} favoriteLimitReached={false} />);
	await star.click();
	expect(mutate).toHaveBeenCalledWith(true);
});

test('Allows removing a favorite even when the limit is reached', async () => {
	const screen = await render(
		<Card client={{ ...client, isFavorite: true }} favoriteLimitReached />,
	);
	await screen.getByRole('button', { name: 'Favourite' }).click();
	expect(mutate).toHaveBeenCalledWith(false);
});
