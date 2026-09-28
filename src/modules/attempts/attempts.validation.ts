import { z } from 'zod';

export const startAttemptSchema = z.object({
  level_id: z.uuid(),
});
export type StartAttemptBody = z.infer<typeof startAttemptSchema>;

export const saveAnswerSchema = z
  .object({
    selected_option_id: z.uuid().nullable().optional(),
    is_skipped: z.boolean().optional(),
    is_flagged: z.boolean().optional(),
  })
  .refine((b) => b.selected_option_id !== undefined || b.is_skipped !== undefined || b.is_flagged !== undefined, {
    message: 'Provide selected_option_id, is_skipped or is_flagged',
  })
  .refine((b) => !(b.is_skipped && b.selected_option_id), {
    message: 'A skipped question cannot have a selected option',
  });
export type SaveAnswerBody = z.infer<typeof saveAnswerSchema>;

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        attempt_question_id: z.uuid(),
        selected_option_id: z.uuid().nullable(),
      }),
    )
    .default([]),
  // Set by the client timer when time runs out
  auto_submit: z.boolean().default(false),
});
export type SubmitAttemptBody = z.infer<typeof submitAttemptSchema>;
