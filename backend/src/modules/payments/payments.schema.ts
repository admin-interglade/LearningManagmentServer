import { z } from 'zod';

const secret = z.string().trim().max(200).nullish().transform((v) => v || null);

export const paymentSettingsSchema = z.object({
  provider: z.string().trim().default('Razorpay')
    .refine((p) => p.toLowerCase() === 'razorpay', 'Only Razorpay is supported'),
  keyId: z.string().trim().max(100).nullish().transform((v) => v || null),
  /** Blank secret = keep the saved one. */
  keySecret: secret,
  webhookSecret: secret,
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').default('INR').transform((s) => s.toUpperCase()),
  merchantName: z.string().trim().min(2, 'Merchant name is required').max(100),
  merchantEmail: z.email('Enter a valid email').trim().nullish().or(z.literal('').transform(() => null)).transform((v) => v ?? null),
  gstPercent: z.number('GST % is required').min(0, 'GST must be 0-100').max(100, 'GST must be 0-100'),
  testMode: z.boolean().default(true),
  enabled: z.boolean().default(true),
});
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

export const verifySchema = z.object({
  registrationId: z.uuid('Invalid registration'),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const mockCompleteSchema = z.object({ registrationId: z.uuid('Invalid registration') });

export const ledgerQuery = z.object({
  examId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
