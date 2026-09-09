import { kebabCase } from 'es-toolkit';
import { type KebabCase } from 'type-fest';
import { z } from 'zod';

import { problems } from './registry';

export const ProblemDetails = z
	.looseObject({
		/** Problem type URI. Default: "about:blank" */
		type: z.url().max(2000).default('about:blank').meta({ description: 'Problem type URI' }),
		/** Short summary of the problem type */
		title: z.string().max(255).meta({ description: 'Short summary of the problem type' }),
		/** HTTP status code */
		status: z.int32().min(100).max(599).meta({ description: 'HTTP status code' }),
		/** Human-readable explanation specific to this occurrence */
		detail: z.string().max(2000).optional().meta({ description: 'Human-readable explanation' }),
		/** URI that identifies the specific occurrence */
		instance: z.url().max(2000).optional().meta({ description: 'URI identifying the occurrence' }),

		//
		// EXTENSIONS

		/** Machine-readable error code, derived from the registry key that produced this response */
		code: z
			.enum(problems.types().map(<S extends string>(key: S) => kebabCase(key) as KebabCase<S>))
			.optional(),
	})
	.meta({ title: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof ProblemDetails>;
