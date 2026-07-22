import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestProject } from 'vitest/node';

import { createMigratedTestTemplate } from './pglite';

export default async function setup(project: TestProject) {
	const directory = await mkdtemp(path.join(tmpdir(), 'invoicer-pglite-'));

	const templatePath = path.join(directory, 'template.tar');
	const template = await createMigratedTestTemplate();

	await writeFile(templatePath, new Uint8Array(await template.arrayBuffer()));
	project.provide('pgliteTemplatePath', templatePath);

	return async () => await rm(directory, { recursive: true, force: true });
}
