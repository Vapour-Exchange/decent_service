import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { commonValidations } from '@/common/utils/commonValidation';

extendZodWithOpenApi(z);

export const TokenSchema = z.object({
  address: z.string(),
  decimal: z.number(),
  symbol: z.string(),
  name: z.string(),
  amount: z.number().optional(),
});

export type Token = z.infer<typeof TokenSchema>;

export const SwapSchema = z.object({
  tokenInput: TokenSchema,
  tokenOutput: TokenSchema,
});

export type Swap = z.infer<typeof SwapSchema>;
