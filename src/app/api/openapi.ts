import { convertToOpenAPISchema } from '@standard-community/standard-openapi/convert';
import { isFunction } from 'es-toolkit';
import { type Env, type Hono, type Schema } from 'hono';
import { generateSpecs, loadVendor } from 'hono-openapi';
import {
	$ZodCheck,
	type $ZodChecks,
	type $ZodType,
	type JSONSchemaGeneratorParams,
	toJSONSchema,
} from 'zod/v4/core';

import { auth } from '@/auth';

type ZodCheckType = $ZodChecks['_zod']['def']['check'];

/** Checks whether a value is a {@link $ZodCheck} object */
const isZodCheck = (value: unknown): value is $ZodCheck => value instanceof $ZodCheck;

/** Returns array of all {@link $ZodCheck} within a schema chain */
const getZodChecks = (schema: $ZodType) => {
	const { def } = schema._zod;
	if (!('checks' in def) || !Array.isArray(def.checks)) return [];
	return def.checks.filter(isZodCheck);
};

/** Checks whether a schema has an explicit check with the given Zod check name */
const hasExplicitCheck = (schema: $ZodType, target: ZodCheckType) =>
	getZodChecks(schema).some(check => check._zod.def.check === target);

/** Returns the RegEx patterns from explicit chained checks */
const getExplicitPatterns = (schema: $ZodType) =>
	getZodChecks(schema).flatMap(check => {
		const { def } = check._zod;
		return 'pattern' in def && def.pattern instanceof RegExp ? [def.pattern.source] : [];
	});

/** Identifies Zod types whose intrinsic regex is redundant in OpenAPI
 * @param format The Zod def.format, not generated OpenAPI format */
const hasIntrinsicPattern = (format: string | undefined) =>
	format && new Set(['uuid', 'email', 'date', 'datetime', 'base64', 'base64url']).has(format);

/** Identifies Zod formats represented by contentEncoding rather than OpenAPI format.
 * @param format The Zod def.format, not generated OpenAPI format */
const isContentEncodingFormat = (format: string | undefined) =>
	format && new Set(['base64', 'base64url']).has(format);

/** Creates the Zod JSON Schema override used by the OpenAPI vendor loader. */
const composeZodOverride = (existing: unknown): JSONSchemaGeneratorParams['override'] => {
	const previous = isFunction(existing) ? existing : undefined;

	return context => {
		// Reapply existing JSON Schema gen
		previous?.(context);

		const { def } = context.zodSchema._zod;

		if ('format' in def && def.format === 'int32') {
			context.jsonSchema.format = 'int32';
			if (!hasExplicitCheck(context.zodSchema, 'greater_than')) delete context.jsonSchema.minimum;
			if (!hasExplicitCheck(context.zodSchema, 'less_than')) delete context.jsonSchema.maximum;
		}

		if ('format' in def && hasIntrinsicPattern(def.format)) {
			// We don't need to define both format and contentEncoding.
			// The upstream Zod behaviour differs depending on chained validators (eg. .regex() removes format)
			if (isContentEncodingFormat(def.format)) delete context.jsonSchema.format;
			// We should always define format when stripping intrinsic pattern, else there is no spec constraint
			// The upstream Zod behaviour differs depending on chained validators (eg. .regex() removes format)
			// NB: OpenAPI defines 'date-time' not 'datetime' (which Zod uses internally)
			else context.jsonSchema.format = def.format === 'datetime' ? 'date-time' : def.format;

			const patterns = getExplicitPatterns(context.zodSchema);
			if (patterns.length > 0) {
				// Removes only the intrinsic pattern while retaining explicit regex constraints
				const allOf = context.jsonSchema.allOf;

				if (!Array.isArray(allOf)) return;

				context.jsonSchema.allOf = allOf.filter(
					schema => typeof schema.pattern !== 'string' || patterns.includes(schema.pattern),
				);
			} else delete context.jsonSchema.pattern;
		}
	};
};

loadVendor('zod', {
	toOpenAPISchema: (schema, context) =>
		convertToOpenAPISchema(
			// @ts-expect-error -- converter/runtime compatibility with Zod 4 JSON Schema
			toJSONSchema(schema, {
				// Matches the upstream default (@standard-community/standard-openapi)
				io: context.options?.io ?? 'input',
				unrepresentable: 'any',
				override: composeZodOverride(context.options?.override),
				target: 'draft-07',
			}),
			context,
		),
});

/** Path to the interactive API reference page, relative to the dashboard origin */
export const apiDocsPath = '/docs/api';

export const documentConfig = {
	info: {
		title: 'Invoicer API',
		version: 'unstable_internal',
		description: 'Internal REST API for the Invoicer dashboard.',
	},
	servers: [
		{
			url: '/api',
			description: 'Base URL for the Invoicer API (production).',
			'x-internal': true,
		},
	],
	tags: [
		{ name: 'Address', description: 'Address metadata operations.' },
		{ name: 'Avatar', description: 'User avatar operations.' },
		{ name: 'Clients', description: 'Client directory operations.' },
		{ name: 'Config', description: 'User configuration operations.' },
		{ name: 'Invoices', description: 'Invoice listing operations.' },
		{ name: 'Meta', description: 'API root and health check operations.' },
	].toSorted((a, b) => a.name.localeCompare(b.name, 'en')),
};

/** Routes documented for CI lint + fuzz coverage, but withheld from the production-served spec. */
const internalOnly = {
	paths: /^\/avatar(\/|$)/,
	tags: ['Avatar'],
};

/** @internal Requires explicit routes to be provided. Prefer export from `@/api/hono` */
export async function getOpenApiDocument(routes: Hono<Env, Schema, '/'>) {
	const authContext = await auth.$context;

	return generateSpecs(routes, {
		documentation: {
			...documentConfig,
			components: {
				securitySchemes: {
					SessionCookie: {
						type: 'apiKey',
						in: 'cookie',
						name: authContext.authCookies.sessionToken.name,
						description: 'Authentication via ambient session cookie',
					},
				},
			},
		},
		// Strip internal routes (and their now-orphaned tags) from the spec served in production
		...(process.env.NODE_ENV === 'production'
			? { exclude: internalOnly.paths, excludeTags: internalOnly.tags }
			: {}),
	});
}
