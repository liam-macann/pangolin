import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

/** Directory the fuzz campaign writes its report, generated config, and local cache into */
export const ATTACHMENT_DIRECTORY = path.join(process.cwd(), '.vitest-attachments/schemathesis');

/** JUnit XML report Schemathesis writes and the replay test reads back */
export const REPORT_PATH = path.join(ATTACHMENT_DIRECTORY, 'latest.xml');

/** `<testcase>` from Schemathesis's JUnit report: one per API operation (e.g. "GET /clients") */
type TestCase = {
	// Pre-formatted message strings, grouped and rendered by Schemathesis (response body included)
	errors: string[];
	failures: string[];
	name: string;
};

type JunitMessage = { '#text'?: string };
type JunitTestCase = {
	'@_name': string;
	error?: JunitMessage[];
	failure?: JunitMessage[];
};
type JunitReport = { testsuites?: { testsuite?: { testcase?: JunitTestCase[] } } };

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	isArray: tagName => ['testcase', 'failure', 'error'].includes(tagName),
});

const messages = (entries: JunitMessage[] = []) => entries.map(entry => entry['#text'] ?? '');

/** Parses Schemathesis `--report junit` output into one entry per API operation */
function parseSchemathesisReport(xml: string): TestCase[] {
	const report: JunitReport = parser.parse(xml);
	const testcases = report.testsuites?.testsuite?.testcase ?? [];

	return testcases.map(testcase => ({
		errors: messages(testcase.error),
		failures: messages(testcase.failure),
		name: testcase['@_name'],
	}));
}

/** Reads the last Schemathesis JUnit report and parses it into one entry per fuzzed operation */
export const readSchemathesisOperations = () =>
	existsSync(REPORT_PATH) ? parseSchemathesisReport(readFileSync(REPORT_PATH, 'utf8')) : [];
