import { type NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	experimental: {
		useCache: true,
		optimizePackageImports: ['@phosphor-icons/react'],
	},
	turbopack: {
		rules: {
			'*.svg': {
				loaders: ['@svgr/webpack'],
				as: '*.js',
			},
		},
	},
	serverExternalPackages: ['pdfmake'],
};

export default nextConfig;
