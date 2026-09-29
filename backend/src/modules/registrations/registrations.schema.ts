import { z } from 'zod';

export const createRegistrationSchema = z.object({
  examId: z.uuid('Unknown exam'),
  discountCode: z.string().trim().max(30).nullish().transform((v) => v || null),
});

export const selectSlotSchema = z.object({
  levelId: z.string().trim().min(1, 'Choose a level'),
  slotId: z.string().trim().min(1, 'Choose a slot'),
});
