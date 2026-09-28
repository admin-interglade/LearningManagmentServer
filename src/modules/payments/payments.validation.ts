import { z } from 'zod';

export const createOrderSchema = z.object({
  registration_id: z.uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().toUpperCase().length(3),
});
export type CreateOrderBody = z.infer<typeof createOrderSchema>;

export const verifyPaymentSchema = z.object({
  registration_id: z.uuid(),
  razorpay_order_id: z.string().trim().min(1).max(255),
  razorpay_payment_id: z.string().trim().min(1).max(255),
  razorpay_signature: z.string().trim().min(1).max(512),
});
export type VerifyPaymentBody = z.infer<typeof verifyPaymentSchema>;
