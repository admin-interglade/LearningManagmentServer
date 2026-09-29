import { z } from 'zod';

export const startAttemptSchema = z.object({
  registrationId: z.uuid(),
  levelId: z.uuid(),
  mode: z.enum(['practice', 'real']),
});

export const answerSchema = z.object({
  position: z.number().int().min(1),
  selectedIndex: z.number().int().min(0).max(9).nullable(),
});
