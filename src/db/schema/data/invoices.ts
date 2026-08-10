import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	type PgTableExtraConfigValue,
	pgEnum,
	snakeCase,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { users } from '@/db/schema/auth';

import { authUid, policy, relationOwnership } from './_helpers';
import { clientData } from './clients';
import { config } from './config';

export const statusEnum = pgEnum('status', ['unpaid', 'paid', 'refunded']);

export const invoices = snakeCase.table(
	'invoice',
	{
		id: uuid()
			.defaultRandom()
			.primaryKey()
			.references(() => documents.id),

		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** Date of invoice issuance in timezone of record
		 *
		 * @remarks This is stored as a date, not a timestamp, to avoid shift on a region redefinition.
		 * Should IANA table change, wall time derived from the creation timestamp becomes unreliable.
		 */
		issuedAt: date().notNull(),

		/** Date that payment is due in timezone of record
		 *
		 * @remarks This is stored as a date, not a timestamp, to avoid shift on a region redefinition.
		 * Should IANA table change, wall time derived from the creation timestamp becomes unreliable.
		 */
		dueAt: date().notNull(),

		/** Partition used to identify invoice sequence */
		partition: varchar({ length: 50 }),

		/** Index of invoice, by partition */
		index: integer().notNull(),
	},
	(t): PgTableExtraConfigValue[] => [
		// Ensure the logical invoice belongs to the same user as its document
		relationOwnership(t.id, documents),

		// Enforce 1:1 relationship between invoice and invoice status
		// This must be a deferrable foreign key.
		// Drizzle has no helper for this configuration, so this is implemented through a migration
		foreignKey({
			name: 'fk_invoice_status',
			columns: [t.id],
			foreignColumns: [invoiceStatus.id],
		}),

		unique('uq_invoice_id_user_id').on(t.id, t.userId),

		// Ensure that the sequence is unique for each user
		unique('uq_invoice_user_partition_index').on(t.userId, t.partition, t.index).nullsNotDistinct(),
		check('chk_positive_index', sql`${t.index} >= 0`),

		check('chk_due_after_issued', sql`${t.dueAt} >= ${t.issuedAt}`),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: false,
			// Invoices may be voided but not deleted
			delete: false,
		}),
	],
);

export const documents = snakeCase.table(
	'document',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientDataId: uuid()
			.notNull()
			.references(() => clientData.id),

		title: varchar({ length: 100 }),
		/** Description printed under invoice reference */
		description: text(),

		/** Timestamp instant of record creation: do not use for invoice display */
		createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),

		configId: uuid()
			.notNull()
			.references(() => config.id),
	},
	(t): PgTableExtraConfigValue[] => [
		unique('uq_document_id_config').on(t.id, t.configId),
		unique('uq_document_id_user_id').on(t.id, t.userId),

		index('idx_document_client_data_id').on(t.clientDataId),
		index('idx_document_config_id').on(t.configId),
		index('idx_document_user_id').on(t.userId),

		// Enforce that client data is owned by the same user as the invoice
		relationOwnership(t.clientDataId, clientData),

		// Enforce that config is owned by the same user as the invoice
		relationOwnership(t.configId, config),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Documents are referenced by invoices and quotes and must be fully immutable
			update: false,
			delete: false,
		}),
	],
);

export const invoiceStatus = snakeCase.table(
	'invoice_status',
	{
		id: uuid()
			.primaryKey()
			.references(() => invoices.id, { onDelete: 'cascade' }),

		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** Invoice payment status.
		 *
		 * @remarks Note that this does not include the invoice void state.
		 * This is intentional, as payment realities may vary (eg. a client may accidentally pay a voided invoice)
		 */
		status: statusEnum().notNull(),
		/** Private notes for the user */
		notes: text(),
		/** Whether the invoice has been voided */
		isVoid: boolean().notNull().default(false),
	},
	t => [
		index('idx_invoice_status_user_id').on(t.userId),

		// Enforce that status data is owned by the same user as the invoice
		relationOwnership(t.id, invoices),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: authUid(t.userId),
			delete: false,
		}),
	],
);

export const namespaceEnum = pgEnum('namespace', ['invoice']);
/** Watermark table: resolves concurrency issues for each sequential counter */
export const sequencer = snakeCase.table(
	'sequencer',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** Document namespace (eg. `invoice` or `quote`) */
		namespace: namespaceEnum().notNull(),

		/** `null` for global sequencing, or a sequence key (eg `2026` in annual mode) */
		partition: varchar({ length: 50 }),

		/** @remarks Equivalent to the last committed value, not the next value in the sequence */
		count: integer().notNull().default(0),

		/** Logs the when the count was last modified */
		updatedAt: timestamp({ withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},

	t => [
		unique('uq_sequencer_user_series_partition')
			.on(t.userId, t.namespace, t.partition)
			.nullsNotDistinct(),

		check('chk_positive_count', sql`${t.count} >= 0`),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: authUid(t.userId),
			delete: false,
		}),
	],
);
