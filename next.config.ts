import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	experimental: {
		useCache: true,
		optimizePackageImports: ['@phosphor-icons/react'],
	},
	serverExternalPackages: ['pdfmake'],
};

export default nextConfig;
