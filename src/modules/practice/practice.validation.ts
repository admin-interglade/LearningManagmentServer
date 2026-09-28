import { z } from 'zod';

export const configurePracticeSchema = z.object({
  exam_id: z.uuid(),
  attempts_allowed: z.coerce.number().int().min(1),
  duration_minutes: z.coerce.number().int().min(1).max(24 * 60),
  question_count: z.coerce.number().int().min(1).max(1000),
});
export type ConfigurePracticeBody = z.infer<typeof configurePracticeSchema>;

export const submitPracticeSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.uuid(),
        selected_option_id: z.uuid().nullable(),
      }),
    )
    .default([]),
});
export type SubmitPracticeBody = z.infer<typeof submitPracticeSchema>;
