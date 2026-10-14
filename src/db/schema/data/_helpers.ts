import {
	type Column,
	getColumnTable,
	getTableName,
	is,
	type SQL,
	sql,
	type Table,
} from 'drizzle-orm';
import {
	type AnyPgColumn,
	type AnyPgColumnBuilder,
	check,
	foreignKey,
	type PgBuildExtraConfigColumns,
	type PgPolicy,
	type PgPolicyToOption,
	PgRole,
	type PgTable,
	type PgTableExtraConfigValue,
	type PgUUID,
	pgPolicy,
	snakeCase,
	timestamp,
} from 'drizzle-orm/pg-core';

import { type Brand } from '@/lib/utils';
import { type AuthTransaction } from '@/db';
import { authenticated } from '@/db/schema/auth';

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

const scdDates = {
	validFrom: timestamp('valid_from', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	/** Date that the record ceased to be active (`null` indicates the record is still active)
	 *
	 * Use the {@link invalidateActiveScd()} function to invalidate the active SCD row.
	 */
	validTo: timestamp('valid_to', { withTimezone: true, mode: 'string' }),
};

type SCDFields = { [K in keyof typeof scdDates]: Column };
type SCDTable<T extends Table & SCDFields = Table & SCDFields> = Brand<T, 'ScdTable'>;

export function scdTable<TColumnsMap extends Record<string, AnyPgColumnBuilder>>(
	name: string,
	// Don't allow SCD validity dates to be overridden
	columns: TColumnsMap & { [K in keyof typeof scdDates]?: never },

	extraConfig?: (
		self: PgBuildExtraConfigColumns<TColumnsMap & typeof scdDates>,
	) => PgTableExtraConfigValue[],
) {
	const table = snakeCase.table(
		name,
		{
			...scdDates,
			...(columns as TColumnsMap),
		},
		t => [
			...(extraConfig ? extraConfig(t) : []),

			/** Prevent updates to SCD data */
			pgPolicy(`scd_table_immutable`, {
				as: 'restrictive',
				for: 'update',
				using: sql`false`,
				withCheck: sql`false`,
			}),

			// Ensure validFrom is in the past (scheduled updates are not allowed)
			check(`chk_${name}_valid`, sql`${t.validFrom} <= now()`),
		],
	);

	// Apply your existing Brand helper here
	return table as SCDTable<typeof table>;
}

/** Invalidates an active SCD row for the given table, for the user authenticated via RLS.
 *
 * @remarks No-op if provided row is already invalid
 */
export const invalidateActiveScd = <TTable extends SCDTable & { userId: PgUUID; id: PgUUID }>(
	tx: AuthTransaction,
	table: TTable,
	id: string | undefined,
) => id && tx.execute(sql`SELECT invalidate_active_scd(${getTableName(table)}, ${id})`);

//
//
//
// RLS

/**
 * Generates a set of PostgreSQL row-level security (RLS) policies for CRUD operations based on the provided options.
 *
 * For each operation, you may set either a SQL expression or a boolean value to define the policy. Set to `null` to prevent the policy from being generated
 *
 * @example
 * ```ts
 * policy({
 *   role: 'admin',
 *   select: authUid(table.userId),
 *   insert: authUid(table.userId),
 *   update: false,
 *   delete: null,
 * });
 * ```
 *
 * @param options - An object containing the policy configuration.
 * @param options.role - The PostgreSQL role(s) to apply the policy to. Can be a single `PgRole` instance or an array of `PgRole` instances or role names.
 * @returns An array of PostgreSQL policy definitions, one for each CRUD operation.
 *
 * @remarks Modified version of the Neon crudPolicy helper that is explicit about each operation
 */
export const policy = ({
	role = authenticated,
	...options
}: {
	/** The PostgreSQL role(s) to apply the policy to. Can be a single `PgRole` instance or an array of `PgRole` instances or role names. */
	role?: PgPolicyToOption;

	select: SQL | boolean | null;
	insert: SQL | boolean | null;
	update: SQL | boolean | null;
	delete: SQL | boolean | null;
}): (PgPolicy | undefined)[] => {
	// Enforce that all CRUD operations have a policy defined (including explicit `null` values)
	(['select', 'insert', 'update', 'delete'] as const).forEach(key => {
		if (options[key] === undefined) throw new Error(`crudPolicy requires a ${key} policy`);
	});

	/** Transform the input to valid SQL */
	const value = (v: SQL | boolean | null) => {
		if (v === true) return sql`true`;
		if (v === false) return sql`false`;
		return v || undefined;
	};

	const select = value(options.select);
	const insert = value(options.insert);
	const update = value(options.update);
	const del = value(options.delete);

	const roleNames = (Array.isArray(role) ? role : [role])
		.map(it => (is(it, PgRole) ? it.name : it))
		.join('-');

	return [
		select &&
			pgPolicy(`granular-crud-${roleNames}-policy-select`, {
				for: 'select',
				to: role,
				using: select,
			}),
		insert &&
			pgPolicy(`granular-crud-${roleNames}-policy-insert`, {
				for: 'insert',
				to: role,
				withCheck: insert,
			}),
		update &&
			pgPolicy(`granular-crud-${roleNames}-policy-update`, {
				for: 'update',
				to: role,
				using: update,
				withCheck: update,
			}),
		del &&
			pgPolicy(`granular-crud-${roleNames}-policy-delete`, {
				for: 'delete',
				to: role,
				using: del,
			}),
	].filter(Boolean);
};

/** Whether a row belongs to the authenticated user.
 * @remarks Only the setting is a subquery, so Postgres evaluates it once per query, not once per row. */
export const authUid = (userIdColumn: AnyPgColumn) =>
	sql`${userIdColumn} = (select current_setting('app.user_id')::uuid)`;

/** Composite FK ensuring a child row matches parent `user_id` */
export const relationOwnership = (
	column: AnyPgColumn,
	parent: PgTable & { id: AnyPgColumn; userId: AnyPgColumn },
) => {
	const child = getColumnTable<PgTable & { userId: AnyPgColumn }>(column);

	return foreignKey({
		name: `fk_${getTableName(child)}_${getTableName(parent)}_ownership`,
		columns: [column, child.userId],
		foreignColumns: [parent.id, parent.userId],
	});
};
