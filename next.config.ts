import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	cacheComponents: true,
	experimental: {
		optimizePackageImports: ['@phosphor-icons/react'],
	},
	serverExternalPackages: ['pdfmake'],
};

export default nextConfig;
