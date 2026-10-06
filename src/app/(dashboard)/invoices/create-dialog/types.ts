import type * as DTO from '@/api/dto/config';

import { type LineItemsConfig } from './line-items/types';

export type CreateInvoiceConfig = LineItemsConfig & Pick<DTO.Config, 'timezone'>;
