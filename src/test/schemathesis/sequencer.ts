import { BaseSequencer, type TestSpecification } from 'vitest/node';

/** Ensures `schemathesis.generate.test.ts` is run before `schemathesis.test.ts */
export class SchemathesisSequencer extends BaseSequencer {
	async sort(files: TestSpecification[]) {
		const sorted = await super.sort(files);
		const rank = (file: TestSpecification) =>
			file.moduleId.endsWith('/schemathesis.generate.fuzz.ts')
				? 0
				: file.moduleId.endsWith('/schemathesis.replay.fuzz.ts')
					? 1
					: 2;
		return [...sorted].sort((a, b) => rank(a) - rank(b));
	}
}
