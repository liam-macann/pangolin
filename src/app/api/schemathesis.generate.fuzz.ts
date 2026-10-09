import { runSchemathesis } from '@/test/schemathesis/fixture';
import { asUser } from '@/test/session';

asUser(
	'Produces a complete Schemathesis report against the disposable database',
	async ({ session, seed }) => {
		// Seed disposable database
		await seed.all();

		// Throws if Schemathesis never produced a report
		await runSchemathesis(session);
	},
	120_000,
);
