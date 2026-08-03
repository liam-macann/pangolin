import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { assert, describe, test } from 'vitest';

import { foreignKeys } from './tests/helpers';

const columnName = (value: unknown) =>
	typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;

describe('Foreign key indexes', () => {
	const isIndexed = (fk: (typeof foreignKeys)[number]) => {
		const config = getTableConfig(fk.table);

		return [
			...config.columns.filter(column => column.primary).map(column => [column]),
			...config.primaryKeys.map(key => key.columns),
			...config.uniqueConstraints.map(constraint => constraint.columns),
			...config.indexes.map(index => index.config.columns),
		].some(([column]) => columnName(column) === fk.columns[0].name);
	};

	test.for(
		foreignKeys
			.filter(({ columns }) => columns.length === 1)
			.map(fk => [`${getTableName(fk.table)}.${fk.columns[0].name}`, fk] as const),
	)("FK '%s' is indexed", ([label, fk]) => assert(isIndexed(fk), `${label} is not indexed`));
});
