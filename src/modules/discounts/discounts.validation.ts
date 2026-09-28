import { z } from 'zod';
import { DISCOUNT_TYPE } from '../../common/constants/statuses';

const fields = {
  code: z.string().trim().toUpperCase().min(3).max(100).regex(/^[A-Z0-9_-]+$/, 'Code may only contain A-Z, 0-9, _ and -'),
  discount_type: z.enum(DISCOUNT_TYPE),
  discount_value: z.coerce.number().positive(),
  valid_from: z.coerce.date(),
  valid_to: z.coerce.date(),
  usage_limit: z.coerce.number().int().min(1),
  max_discount: z.coerce.number().positive().nullish(),
  exam_id: z.uuid().nullish(),
  is_active: z.boolean().default(true),
};

export interface DiscountRules {
  discount_type: string;
  discount_value: number;
  valid_from: Date;
  valid_to: Date;
}

export const discountRuleErrors = (d: DiscountRules): string[] => {
  const errors: string[] = [];
  if (d.valid_from >= d.valid_to) errors.push('valid_from must be before valid_to');
  if (d.discount_type === 'percentage' && d.discount_value > 100) errors.push('Percentage discount cannot exceed 100');
  return errors;
};

export const createDiscountSchema = z.object(fields).superRefine((body, ctx) => {
  for (const message of discountRuleErrors(body)) ctx.addIssue({ code: 'custom', message });
});
export type CreateDiscountBody = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = z
  .object({ ...fields, is_active: z.boolean() })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });
export type UpdateDiscountBody = z.infer<typeof updateDiscountSchema>;
