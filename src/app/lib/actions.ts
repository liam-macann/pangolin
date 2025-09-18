'use server';

import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import postgres from 'postgres';
import { auth, signIn } from '@/auth';

// biome-ignore lint/style/noNonNullAssertion: DB URL is always present
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

import { eq } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import z from 'zod';
import { invoices, invoices as invoicesSchema } from '@/db/schema';
import type { Prettify } from '@/lib/utils';
import { db } from '@/src/db';

export type State =
	| {
			success: false;
			errors?: {
				formErrors: string[];
				fieldErrors: Record<string, string[] | undefined>;
			};
			message?: string | null;
	  }
	| {
			success: true;
			message: string;
	  };

export async function createInvoice(
	data: Prettify<Pick<typeof invoicesSchema.$inferInsert, 'clientId' | 'amount'>>,
): Promise<State> {
	const session = await auth();
	console.log(session);
	if (!session?.user?.id) {
		return {
			success: false,
			message: 'User is not authenticated',
		};
	}

	const defaults: typeof invoicesSchema.$inferInsert = {
		status: 'unpaid',
		...data,
		userId: session.user.id,
	};

	// Validate form using Zod
	const validated = createInsertSchema(invoicesSchema).safeParse(defaults);

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validated.success) {
		return {
			success: false,
			errors: z.flattenError(validated.error),
			message: 'Failed to create invoice. Please ensure all fields are valid.',
		};
	}

	// Prepare data for insertion into the database
	const { clientId, amount, userId, status } = validated.data;

	// Insert data into the database
	try {
		await sql`
      INSERT INTO invoices (client_id, user_id, amount, status)
      VALUES (${clientId}, ${userId}, ${amount}, ${status})
    `;
	} catch {
		// If a database error occurs, return a more specific error.
		return {
			message: `Database Error: failed to create invoice`,
			success: false,
		};
	}

	// Revalidate the cache for the invoices page
	revalidatePath('/dashboard/invoices');

	return {
		success: true,
		message: 'Invoice created',
	};
}

const updateInvoiceSchema = createUpdateSchema(invoices).omit({ id: true });
export async function updateInvoice(id: string, data: z.input<typeof updateInvoiceSchema>) {
	const session = await auth();
	console.log(session);
	if (!session?.user?.id) {
		return {
			success: false,
			message: 'User is not authenticated',
		};
	}

	const { success, error, data: validated } = updateInvoiceSchema.safeParse(data);

	if (!success) {
		return {
			success: false,
			errors: z.flattenError(error),
			message: 'Invalid fields. Failed to update invoice.',
		};
	}

	if (Object.keys(validated).length === 0) {
		return {
			success: true,
			message: 'No fields to update',
		};
	}

	try {
		await db.update(invoices).set(validated).where(eq(invoices.id, id));
	} catch (_error) {
		return {
			success: false,
			message: 'Database Error: Failed to update invoice',
		};
	}

	revalidatePath('/dashboard/invoices');

	return {
		success: true,
		message: 'Invoice amended',
	};
}

export async function authenticate(_prevState: string | undefined, formData: FormData) {
	try {
		await signIn('credentials', formData);
	} catch (error) {
		if (error instanceof AuthError) {
			switch (error.type) {
				case 'CredentialsSignin':
					return 'Invalid email or password';
				default:
					return 'Something went wrong';
			}
		}
		throw error;
	}
}
