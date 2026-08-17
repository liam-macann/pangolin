import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild, { type Plugin } from 'esbuild';

const env = {
	DATABASE_URL: 'postgres://openapi:openapi@localhost:5432/openapi',
	PGPASSWORD_AUTHENTICATED: 'openapi',
	AUTH_GOOGLE_ID: 'openapi',
	AUTH_GOOGLE_SECRET: 'openapi',
	BETTER_AUTH_URL: 'http://localhost:3000',
};

Object.entries(env).forEach(([key, value]) => {
	process.env[key] ??= value;
});

const root = path.resolve(import.meta.dirname, '..');
const stubs: Record<string, string> = {
	'server-only': 'export {}',
	'next/navigation':
		'export const notFound = () => {}; export const forbidden = () => {}; export const unauthorized = () => {}; export const unstable_rethrow = error => { throw error }',
	react: 'export const cache = fn => fn; export const experimental_taintObjectReference = () => {}',
};

const plugin: Plugin = {
	name: 'openapi',
	setup(build) {
		build.onResolve({ filter: /^[^./]/ }, args => {
			if (args.path in stubs) return { path: args.path, namespace: 'stub' };
			if (args.path === 'lib-address') {
				const packagePath = fileURLToPath(import.meta.resolve('lib-address/package.json'));
				return { path: path.join(path.dirname(packagePath), 'dist/entry-node.cjs') };
			}
			if (!args.path.startsWith('@/')) return { path: args.path, external: true };
		});
		build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
			contents: stubs[args.path],
			loader: 'js',
		}));
	},
};

async function main() {
	const result = await esbuild.build({
		entryPoints: [path.join(root, 'src/app/api/hono.ts')],
		absWorkingDir: root,
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: 'node24',
		write: false,
		plugins: [plugin],
	});
	const bundlePath = path.join(root, `scripts/.openapi-${process.pid}.mjs`);
	fs.writeFileSync(bundlePath, result.outputFiles[0].text);

	try {
		const { getOpenApiDocument } = await import(bundlePath);
		const document = await getOpenApiDocument();
		fs.writeFileSync(path.join(root, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
	} finally {
		fs.unlinkSync(bundlePath);
	}
}

main();
