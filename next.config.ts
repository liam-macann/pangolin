import { type NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	experimental: {
		useCache: true,
		optimizePackageImports: ['@phosphor-icons/react'],
		authInterrupts: true,
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

export default nextConfig;
