import { type ExecException, execFile as execFileCallback } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { type ServerType, serve } from '@hono/node-server';
import { getSessionCookie } from 'better-auth/cookies';

import app from '@/api/hono';

import { type Session } from '@/auth';
import { ATTACHMENT_DIRECTORY, REPORT_PATH } from '@/test/schemathesis/report';
import { sessionStorage } from '@/test/session';

const execFile = promisify(execFileCallback);

const SCHEMATHESIS_VERSION = '4.27.0';
const SCHEMATHESIS_SESSION_TOKEN = 'SCHEMATHESIS_SESSION_TOKEN';

const isExecException = (error: unknown): error is ExecException =>
	error instanceof Error && 'cmd' in error;

async function writeSchemathesisConfig(): Promise<string> {
	await mkdir(ATTACHMENT_DIRECTORY, { recursive: true });
	const configPath = path.join(ATTACHMENT_DIRECTORY, 'schemathesis.toml');

	const content = [
		'hooks = "src.test.schemathesis.hooks"',
		'',
		'[auth.openapi.SessionCookie]',
		`api_key = "\${${SCHEMATHESIS_SESSION_TOKEN}}"`,
		'',
		'[cache]',
		`directory = ${JSON.stringify(path.join(ATTACHMENT_DIRECTORY, 'cache'))}`,
	].join('\n');

	await writeFile(configPath, content);
	return configPath;
}

/** Starts a local server that serves the Hono API with the given session token */
async function startServer(session: Session) {
	let server: ServerType | undefined;

	const isServerNotRunning = (error: Error) =>
		'code' in error && error.code === 'ERR_SERVER_NOT_RUNNING';

	let closePromise: Promise<void> | undefined;
	const close = () => {
		if (closePromise) return closePromise;

		return new Promise<void>((resolve, reject) => {
			if (!server) return resolve();

			server.close(error => {
				if (!error || isServerNotRunning(error)) return resolve();
				reject(error);
			});
		});
	};

	try {
		const baseUrl = await new Promise<string>((resolve, reject) => {
			server = serve(
				{
					hostname: '127.0.0.1',
					port: 0,
					serverOptions: {
						// Let generated invalid URLs reach Hono instead of failing in the harness
						maxHeaderSize: 64 * 1024,
					},
					fetch: req => {
						// Isolate the incoming request entirely from the ambient test context
						return sessionStorage.exit(() => {
							const cookie = getSessionCookie(req, { cookiePrefix: 'pangolin' });

							// Only populate sessionStorage if the request sends the matching session token
							if (cookie === session.session.token) {
								return sessionStorage.run(session, () => app.fetch(req));
							}

							// Unauthenticated / mismatching requests run with empty sessionStorage context
							return app.fetch(req);
						});
					},
				},
				info => resolve(`http://127.0.0.1:${info.port}`),
			).on('error', reject);
		});

		return { baseUrl, close };
	} catch (error) {
		await close();
		throw error;
	}
}

export async function runSchemathesis(session: Session): Promise<string> {
	await rm(REPORT_PATH, { force: true });
	const configPath = await writeSchemathesisConfig();
	const server = await startServer(session);

	try {
		const args = [
			['--from', `schemathesis==${SCHEMATHESIS_VERSION}`],
			'st',
			['--config-file', configPath],
			'run',
			[`${server.baseUrl}/api/openapi.json`],
			['--url', `${server.baseUrl}/api`],
			['--workers', '1'],
			['--checks', 'all'],
			['--max-examples', '25'],
			['--report', 'junit'],
			['--report-junit-path', REPORT_PATH],
		].flat();

		const { stdout, stderr } = await execFile('uvx', args, {
			env: { ...process.env, [SCHEMATHESIS_SESSION_TOKEN]: session.session.token },
			maxBuffer: 10 * 1024 * 1024,
		});

		return `${stdout}${stderr}`;
	} catch (error) {
		if (!isExecException(error)) throw error;

		const details = [error.stdout, error.stderr, error.message].filter(Boolean).join('');

		if (existsSync(REPORT_PATH)) return details;

		if (error.code === 'ENOENT') {
			throw new Error(
				[
					'Schemathesis requires the `uvx` command, but it was not found on PATH.',
					'Install uv from https://docs.astral.sh/uv/getting-started/installation/ or add astral-sh/setup-uv to CI.',
				].join('\n'),
			);
		}

		throw new Error(details || 'Schemathesis run failed without producing a report');
	} finally {
		await server.close();
	}
}
