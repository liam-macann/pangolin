import { withSentryConfig } from '@sentry/nextjs';
import { type NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	experimental: {
		useCache: true,
		optimizePackageImports: ['@phosphor-icons/react'],
		authInterrupts: true,
		taint: true,
	},
	turbopack: {
		rules: {
			'*.svg': {
				loaders: ['@svgr/webpack'],
				as: '*.js',
			},
		},
	},
	async redirects() {
		return [
			{
				source: '/dashboard',
				destination: '/invoices',
				permanent: true,
			},
			{
				source: '/dashboard/:path+',
				destination: '/:path+',
				permanent: true,
			},
		];
	},
	serverExternalPackages: ['pdfmake'],
};

export default withSentryConfig(nextConfig, {
	org: 'liam-macann',
	project: 'invoicer',

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	tunnelRoute: '/monitoring',

	webpack: {
		// Enables automatic instrumentation of Vercel Cron Monitors
		automaticVercelMonitors: true,

		treeshake: { removeDebugLogging: true },
	},
});
