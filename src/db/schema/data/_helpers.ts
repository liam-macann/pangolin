import {
	type Columns,
	type ColumnType,
	getColumns,
	getColumnTable,
	getTableName,
	is,
	type SQL,
	sql,
} from 'drizzle-orm';
import {
	type AnyPgColumn,
	type AnyPgColumnBuilder,
	check,
	type ExtraConfigColumn,
	type PgBuildExtraConfigColumns,
	type PgColumnBaseConfig,
	type PgPolicy,
	type PgPolicyToOption,
	PgRole,
	type PgTableExtraConfigValue,
	pgPolicy,
	pgTable,
	timestamp,
} from 'drizzle-orm/pg-core';

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

const scdDates = {
	validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	validTo: timestamp('valid_to', { withTimezone: true, mode: 'date' }),
};

export function scdTable<TColumnsMap extends Record<string, AnyPgColumnBuilder>>(
	name: string,
	// Don't allow SCD validity dates to be overridden
	columns: TColumnsMap & { [K in keyof typeof scdDates]?: never },

	extraConfig?: (
		self: PgBuildExtraConfigColumns<TColumnsMap & typeof scdDates>,
	) => PgTableExtraConfigValue[],
) {
	return pgTable(
		name,
		{
			...scdDates,
			...(columns as TColumnsMap),
		},
		t => [
			...(extraConfig ? extraConfig(t) : []),

			// Ensure validFrom is in the past (scheduled updates are not allowed)
			check(`chk_${name}_valid`, sql`${t.validFrom} <= now()`),
		],
	);
}

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
export const policy = (options: {
	/** The PostgreSQL role(s) to apply the policy to. Can be a single `PgRole` instance or an array of `PgRole` instances or role names. */
	role: PgPolicyToOption;

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

	const roleNames = (Array.isArray(options.role) ? options.role : [options.role])
		.map(it => (is(it, PgRole) ? it.name : it))
		.join('-');

	return [
		select &&
			pgPolicy(`granular-crud-${roleNames}-policy-select`, {
				for: 'select',
				to: options.role,
				using: select,
			}),
		insert &&
			pgPolicy(`granular-crud-${roleNames}-policy-insert`, {
				for: 'insert',
				to: options.role,
				withCheck: insert,
			}),
		update &&
			pgPolicy(`granular-crud-${roleNames}-policy-update`, {
				for: 'update',
				to: options.role,
				using: update,
				withCheck: update,
			}),
		del &&
			pgPolicy(`granular-crud-${roleNames}-policy-delete`, {
				for: 'delete',
				to: options.role,
				using: del,
			}),
	].filter(Boolean);
};

// It is perhaps more idiomatic to perform Column Level Security (CLS) via revoking update permissions,
// but this approach allows policy to be captured in migrations
//
/** Returns a policy that blocks updates to the specified columns via RLS.
 *
 * @example
 * ```ts
 * // Specify which columns should be immutable
 * immutable([t.id]);
 *
 * // Or specify a whitelist of columns to be mutable
 * immutable(t, { except: [t.validTo] });
 * ```
 */
export function immutable<TConfig extends PgColumnBaseConfig<ColumnType>>(
	/** An array of columns that should be immutable */
	columns: ExtraConfigColumn<TConfig>[] | Record<string, ExtraConfigColumn<TConfig>>,

	options?: {
		/** The name of the generated policy */
		name?: string;
		except: ExtraConfigColumn<TConfig>[];
	},
) {
	// Both object and array inputs can be passed to Object.values()
	const inputCols = Object.values(columns);

	// TypeScript ensures all columns belong to the same table, so accessing the first element is safe
	const table = getColumnTable(inputCols[0]);
	const allCols = Object.values(getColumns(table) as Columns);

	const tableName = getTableName(table);

	/** The primary key column(s) of the table. Composite PKs may cause multiple conditions to be generated. */
	const pkCols = allCols.filter(col => col.primary);
	if (pkCols.length === 0) throw new Error(`immutable(): no primary key found on "${tableName}"`);

	const old = sql.identifier('old');

	// Filter out excluded columns
	const excluded = new Set(options?.except?.map(col => col.name) ?? []);
	const included = inputCols.filter(col => !excluded.has(col.name));
	if (included.length === 0) throw new Error(`immutable(): no columns selected on "${tableName}"`);

	const conditions = [
		// Filter subquery to select same row
		...pkCols.map(pk => {
			const name = sql.identifier(pk.name);
			return sql`${old}.${name} = ${name}`;
		}),

		// Check that immutable columns haven't changed
		...included.map(col => {
			const name = sql.identifier(col.name);
			return sql`${old}.${name} IS NOT DISTINCT FROM ${name}`;
		}),
	];

	return pgPolicy(options?.name ?? `${tableName}_immutable_cols`, {
		as: 'restrictive',
		for: 'update',
		using: sql`true`,
		withCheck: sql`EXISTS (
      SELECT * FROM ${sql.identifier(tableName)} ${old}
      WHERE ${sql.join(conditions, sql` AND `)}
    )`,
	});
}

export const authUid = (userIdColumn: AnyPgColumn) =>
	sql`(select current_setting('app.user_id')::uuid = ${userIdColumn})`;
