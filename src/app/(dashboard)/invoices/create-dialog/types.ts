import { type z } from 'zod';

import type * as DTO from '@/api/dto/config';
import { type invoice as schema } from '@/lib/validation/invoice';

import { type LineItemsConfig } from './line-items/types';

export type CreateInvoiceConfig = LineItemsConfig & Pick<DTO.Config, 'timezone'>;

export type CreateInvoiceFormValues = z.input<typeof schema>;
