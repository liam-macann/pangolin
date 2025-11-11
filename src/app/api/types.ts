import type { NextResponse } from 'next/server';
import { z } from 'zod';

/** Zod schema to validate {@link ApiResponse} */
export const responseSchema = z.discriminatedUnion('success', [
	z.object({ success: z.literal(true), data: z.any() }),
	z.object({ success: z.literal(false), error: z.string() }),
]);

/** The data returned in the response body */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

/** The response type for a route handler (GET, POST, etc.) */
export type RouteResponse<T> = Promise<NextResponse<ApiResponse<T>>>;
