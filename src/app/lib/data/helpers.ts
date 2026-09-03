import {
	type DBQueryConfigOrderBy,
	type GetTableViewFieldSelection,
	type RelationsFilter,
	type TableRelationalConfig,
	type TablesRelationalConfig,
} from 'drizzle-orm';
import { unauthorized, unstable_rethrow } from 'next/navigation';

import { type relations } from '@/db/relations';

import { getSession, type Session } from '@/auth';

export type FetchOptions<
	TTableConfig extends TableRelationalConfig,
	TSchema extends TablesRelationalConfig = typeof relations,
> = {
	where?: RelationsFilter<TTableConfig, TSchema>;
	orderBy?: DBQueryConfigOrderBy<
		TTableConfig['table'],
		GetTableViewFieldSelection<TTableConfig['table']>
	>;
	limit?: number;
	offset?: number;
};

export async function query<T>(
	fn: (session: Session) => Promise<T>,
	errorMessage: string,
): Promise<T> {
	const session = await getSession();
	if (!session) unauthorized();

	try {
		return await fn(session);
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error(errorMessage);
	}
}
