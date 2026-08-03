import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';

/** Every exported table, with Drizzle config data attached */
export const tables = Object.values(schema)
	.filter(value => is(value, PgTable))
	.map(table => {
		const config = getTableConfig(table as PgTable);
		return { table, ...config };
	});

/** Every foreign key declared anywhere in the schema, with a source-column → target-column map */
export const foreignKeys = tables.flatMap(t =>
	t.foreignKeys.map(foreignKey => {
		const { columns, foreignColumns, foreignTable } = foreignKey.reference();

		/** Records the column-to-column mapping of a foreign key */
		const mapping = new Map(
			columns.map((column, index) => [column.name, foreignColumns[index].name]),
		);

		return { table: t.table, foreignTable, columns, foreignColumns, mapping };
	}),
);
