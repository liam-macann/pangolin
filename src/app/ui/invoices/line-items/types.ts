import { type FieldValues } from 'react-hook-form';
import { type z } from 'zod';

import type * as DTO from '@/api/dto/config';
import { type invoice as schema } from '@/lib/validation/invoice';

export interface LineItemsFormValues extends FieldValues {
	items: z.input<typeof schema.shape.items>;
}

export type LineItemsConfig = Pick<DTO.Config, 'currency' | 'locale' | 'taxes' | 'taxRegistration'>;
