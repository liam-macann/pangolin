import { insertTestInvoice, setUpConfigAndClient } from '@/lib/actions/tests/fixtures';

import { runSchemathesis } from '@/test/schemathesis/fixture';
import { asUser } from '@/test/session';

asUser(
	'Produces a complete Schemathesis report against the disposable database',
	async ({ session }) => {
		// Seed disposable database
		const { client } = await setUpConfigAndClient();
		await insertTestInvoice({ clientDataId: client.data.scdId });

		// Throws if Schemathesis never produced a report
		await runSchemathesis(session);
	},
	120_000,
);
