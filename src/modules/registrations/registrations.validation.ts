import { z } from 'zod';

export const createRegistrationSchema = z.object({
  exam_id: z.uuid(),
  discount_code: z.string().trim().min(1).max(100).optional(),
});
export type CreateRegistrationBody = z.infer<typeof createRegistrationSchema>;
