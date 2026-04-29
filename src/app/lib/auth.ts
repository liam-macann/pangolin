import { jwtClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const client = createAuthClient({
	plugins: [jwtClient()],
});
export const { signIn, signUp, signOut, useSession, getSession } = client;
