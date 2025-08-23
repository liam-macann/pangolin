import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	/* config options here */
	experimental: {
		optimizePackageImports: ['@phosphor-icons/react'],
		reactCompiler: true,
	},
};

export default nextConfig;
