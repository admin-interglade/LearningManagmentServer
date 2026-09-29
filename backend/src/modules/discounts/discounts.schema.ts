import { z } from 'zod';

export const discountSchema = z.object({
  code: z.string().trim().min(3, 'Code must be at least 3 characters').max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, - or _').transform((s) => s.toUpperCase()),
  label: z.string().trim().max(300).nullish().transform((v) => v || null),
  type: z.enum(['percent', 'flat'], 'Type must be percent or flat'),
  value: z.number('Value is required').positive('Value must be greater than 0'),
  validFrom: z.coerce.date('Enter a valid date'),
  validTo: z.coerce.date('Enter a valid date'),
  maxUses: z.number().int().positive('Max uses must be at least 1').nullish().transform((v) => v ?? null),
  /** Empty = every exam. */
  examIds: z.array(z.uuid('Unknown exam')).default([]),
  active: z.boolean().default(true),
})
  .refine((d) => d.validFrom < d.validTo, { message: 'Valid-to must be after valid-from', path: ['validTo'] })
  .refine((d) => d.type !== 'percent' || d.value <= 100, { message: 'Percentage cannot exceed 100', path: ['value'] });
export type DiscountInput = z.infer<typeof discountSchema>;

export const validateDiscountSchema = z.object({
  examId: z.uuid('Unknown exam'),
  code: z.string().trim().min(1, 'Enter a discount code'),
});
