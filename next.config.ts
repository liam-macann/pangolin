import { withSentryConfig } from '@sentry/nextjs';
import { type NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
	cacheComponents: true,
	reactCompiler: true,
	poweredByHeader: false,
	experimental: {
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
			// Uses zod-compiler to eliminate runtime overhead
			'*.{ts,tsx}': {
				condition: {
					all: [
						{ not: 'foreign' }, // skip node_modules
						{ content: /[Zz]od/ }, // skip files that cannot contain a schema
					],
				},
				loaders: ['zod-compiler/turbopack'],
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
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: [
							"default-src 'self'",
							"base-uri 'self'",
							"form-action 'self'",
							"frame-ancestors 'none'",
							"object-src 'none'",
							"img-src 'self' data: blob:",
							"font-src 'self' data:",
							"connect-src 'self'",
							`script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
							"worker-src 'self' blob:",
							"style-src 'self' 'unsafe-inline'",
						].join('; '),
					},
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Referrer-Policy', value: 'no-referrer' },
					{
						key: 'Permissions-Policy',
						value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
					},
					{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
					{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
					{ key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
					...(isProduction
						? [
								{
									key: 'Strict-Transport-Security',
									value: 'max-age=63072000; includeSubDomains; preload',
								},
							]
						: []),
				],
			},
		];
	},
	serverExternalPackages: ['pdfmake', '@scalar/server-side-rendering'],
};

export default withSentryConfig(nextConfig, {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	telemetry: false,

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
	tunnelRoute: '/monitoring',

	webpack: {
		// Enables automatic instrumentation of Vercel Cron Monitors
		automaticVercelMonitors: true,
		treeshake: { removeDebugLogging: true },
	},
});
