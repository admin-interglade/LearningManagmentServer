import { z } from 'zod';
import { COMPLEXITY } from '../../common/constants/statuses';

const options = z
  .array(
    z.object({
      option_text: z.string().trim().min(1),
      is_correct: z.boolean().default(false),
    }),
  )
  .min(2, 'At least two options are required')
  .max(10)
  .refine((opts) => opts.filter((o) => o.is_correct).length === 1, { message: 'Exactly one option must be correct' });

// Links the question into the level blueprint (level_questions)
const levelCategories = z
  .array(
    z.object({
      level_category_id: z.uuid(),
      weightage: z.coerce.number().positive().default(1),
    }),
  )
  .refine((links) => new Set(links.map((l) => l.level_category_id)).size === links.length, {
    message: 'Duplicate level_category_id',
  });

export const createQuestionSchema = z.object({
  question_text: z.string().trim().min(1),
  complexity: z.enum(COMPLEXITY),
  explanation: z.string().trim().nullish(),
  is_active: z.boolean().default(true),
  options,
  level_categories: levelCategories.default([]),
});
export type CreateQuestionBody = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    question_text: z.string().trim().min(1),
    complexity: z.enum(COMPLEXITY),
    explanation: z.string().trim().nullish(),
    is_active: z.boolean(),
    options,
    level_categories: levelCategories,
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });
export type UpdateQuestionBody = z.infer<typeof updateQuestionSchema>;
