import 'server-only';

export function getAllowedHosts() {
	const hosts =
		process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview'
			? [
					process.env.VERCEL_URL,
					process.env.VERCEL_BRANCH_URL,
					process.env.VERCEL_PROJECT_PRODUCTION_URL,
				]
			: [process.env.BETTER_AUTH_URL];

	return hosts.filter((host): host is string => typeof host === 'string');
}
