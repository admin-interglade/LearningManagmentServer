import { z } from 'zod';
import { COMPLEXITY, EXAM_STATUS } from '../../common/constants/statuses';

const date = z.coerce.date();
const money = z.coerce.number().min(0).max(9_999_999_999.99);

const examFields = {
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().nullish(),
  syllabus: z.string().trim().nullish(),
  registration_start: date,
  registration_end: date,
  exam_start: date,
  exam_end: date,
  fee: money,
  currency: z.string().trim().toUpperCase().length(3).default('INR'),
  status: z.enum(EXAM_STATUS).default('draft'),
  is_published: z.boolean().default(false),
  award: z.string().trim().nullish(),
};

export interface ExamWindow {
  registration_start: Date;
  registration_end: Date;
  exam_start: Date;
  exam_end: Date;
}

export const examWindowErrors = (w: ExamWindow): string[] => {
  const errors: string[] = [];
  if (w.registration_start >= w.registration_end) errors.push('registration_start must be before registration_end');
  if (w.exam_start >= w.exam_end) errors.push('exam_start must be before exam_end');
  if (w.registration_start > w.exam_start) errors.push('registration_start must not be after exam_start');
  if (w.registration_end > w.exam_end) errors.push('registration_end must not be after exam_end');
  return errors;
};

export const createExamSchema = z.object(examFields).superRefine((body, ctx) => {
  for (const message of examWindowErrors(body)) ctx.addIssue({ code: 'custom', message });
});
export type CreateExamBody = z.infer<typeof createExamSchema>;

// Defaults are stripped for updates so omitted fields are left untouched
export const updateExamSchema = z
  .object({
    ...examFields,
    currency: examFields.currency.removeDefault(),
    status: z.enum(EXAM_STATUS),
    is_published: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });
export type UpdateExamBody = z.infer<typeof updateExamSchema>;

export const publishExamSchema = z.object({ is_published: z.boolean() });

export const listExamsQuerySchema = z.object({
  status: z.enum(EXAM_STATUS).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;

const levelFields = {
  level_number: z.coerce.number().int().min(1),
  name: z.string().trim().min(1).max(255).optional(),
  duration_minutes: z.coerce.number().int().min(1).max(24 * 60),
  question_count: z.coerce.number().int().min(1).max(1000),
  max_score: z.coerce.number().min(0),
  attempts_allowed: z.coerce.number().int().min(1).default(1),
};

export const createLevelSchema = z.object(levelFields);
export type CreateLevelBody = z.infer<typeof createLevelSchema>;

export const updateLevelSchema = z
  .object({ ...levelFields, attempts_allowed: z.coerce.number().int().min(1) })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });
export type UpdateLevelBody = z.infer<typeof updateLevelSchema>;

export const createCategorySchema = z.object({
  category_name: z.string().trim().min(1).max(255),
  complexity: z.enum(COMPLEXITY),
  marks_per_question: z.coerce.number().positive(),
  negative_marking: z.coerce.number().min(0).default(0),
});
export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
