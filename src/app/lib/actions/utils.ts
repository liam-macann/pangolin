import 'server-only';

//
//
// This file contains utility functions for server actions, but are not directly callable from client components
// (hence no 'use server' directive)
//

import { and, eq, isNotNull, notExists } from 'drizzle-orm';

import { withRLS } from '@/db';
import * as tables from '@/db/schema';

//
//
// Cleanup functions to remove unused records. These are scoped to a given user, for isolation.
//

/** Clean up unused configs for a given user, preserving the current configuration */
export const cleanupConfigs = (userId: string) =>
	withRLS(db =>
		db.delete(tables.config).where(
			and(
				eq(tables.config.userId, userId),
				isNotNull(tables.config.validTo),
				notExists(
					// No invoices reference config row
					db.select().from(tables.invoices).where(eq(tables.invoices.configId, tables.config.id)),
				),
			),
		),
	)
		// Error should not bubble up: non-essential cleanup
		.catch(() => console.error('Unable to clean up unused configs'));

/** Clean up unused client data for a given user, preserving the current data */
export const cleanupClientData = (userId: string) =>
	withRLS(db =>
		db.delete(tables.clientData).where(
			and(
				eq(tables.clientData.userId, userId),
				isNotNull(tables.clientData.validTo),
				notExists(
					// No invoices reference client data row
					db
						.select()
						.from(tables.invoices)
						.where(eq(tables.invoices.clientDataId, tables.clientData.id)),
				),
			),
		),
	)
		// Error should not bubble up: non-essential cleanup
		.catch(() => console.error('Unable to clean up unused configs'));

/** Clean up unused addresses for a given user */
export const cleanupAddresses = (userId: string) =>
	withRLS(db =>
		db.delete(tables.address).where(
			and(
				eq(tables.address.userId, userId),
				notExists(
					// No configs reference address row
					db.select().from(tables.config).where(eq(tables.config.addressId, tables.address.id)),
				),
				notExists(
					// No clients reference address row
					db
						.select()
						.from(tables.clientData)
						.where(eq(tables.clientData.addressId, tables.address.id)),
				),
			),
		),
	).catch(() => console.error('Unable to clean up unused addresses'));
