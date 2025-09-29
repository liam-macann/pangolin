import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	/* config options here */
	experimental: {
		optimizePackageImports: ['@phosphor-icons/react'],
		reactCompiler: true,
	},
	serverExternalPackages: ['pdfmake'],
};

export default nextConfig;
