import { z } from 'zod';
import { complexitySchema } from '../../common/complexity';

const date = z.coerce.date('Enter a valid date');
const int = (min: number, max: number, label: string) =>
  z.number(`${label} is required`).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`);

/** Ids are optional: rows without one (or with an unsaved draft id) are created. */
const draftId = z.string().trim().max(64).optional();

export const sectionInputSchema = z.object({
  id: draftId,
  category: z.string().trim().min(1, 'Choose a category').max(60),
  complexity: complexitySchema,
  questionCount: int(1, 200, 'Question count'),
  marksPerQuestion: int(1, 100, 'Marks per question').default(1),
});

export const levelInputSchema = z.object({
  id: draftId,
  order: int(1, 100, 'Order'),
  name: z.string().trim().min(1, 'Level name is required').max(120),
  attempts: int(1, 50, 'Attempts'),
  durationMinutes: int(1, 600, 'Duration').nullish(),
  passPercent: z.number('Pass percent is required').min(0, 'Pass percent must be 0-100').max(100, 'Pass percent must be 0-100'),
  sections: z.array(sectionInputSchema).min(1, 'Add at least one section').max(20),
});

const ageBound = z.number().int().min(0).max(120).nullish().transform((v) => v ?? null);

export const examInputSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().trim().max(5000).nullish(),
  award: z.string().trim().max(500).nullish(),
  ageGroupMin: ageBound,
  ageGroupMax: ageBound,
  registrationStart: date,
  registrationEnd: date,
  examStart: date,
  examEnd: date,
  durationMinutes: int(1, 600, 'Duration'),
  registrationFee: z.number('Fee is required').min(0, 'Fee cannot be negative').max(1_000_000),
  practiceAttempts: int(0, 50, 'Practice attempts'),
  practiceQuestionCount: int(1, 200, 'Practice question count').default(10),
  levels: z.array(levelInputSchema).min(1, 'Add at least one level').max(20),
})
  .refine((e) => e.ageGroupMin === null || e.ageGroupMax === null || e.ageGroupMin <= e.ageGroupMax,
    { message: 'Minimum age must be ≤ maximum age', path: ['ageGroupMax'] })
  .refine((e) => e.registrationStart < e.registrationEnd, { message: 'Registration end must be after start', path: ['registrationEnd'] })
  .refine((e) => e.examStart < e.examEnd, { message: 'Exam end must be after start', path: ['examEnd'] })
  .refine((e) => e.registrationStart < e.examEnd, { message: 'Registration must open before the exam ends', path: ['registrationStart'] })
  .refine((e) => new Set(e.levels.map((l) => l.order)).size === e.levels.length, { message: 'Level order must be unique', path: ['levels'] });

export type ExamInput = z.infer<typeof examInputSchema>;
export type LevelInput = ExamInput['levels'][number];

export const publishSchema = z.object({ isPublished: z.boolean('isPublished must be true or false') });

/** `endsAt` is optional: by default a slot stays open for one sitting of the level (its duration). */
export const slotSchema = z.object({
  levelId: z.string().trim().min(1, 'Choose a level'),
  startsAt: date,
  endsAt: date.nullish(),
  capacity: int(1, 100_000, 'Capacity'),
}).refine((s) => !s.endsAt || s.startsAt < s.endsAt, { message: 'Slot end must be after start', path: ['endsAt'] });
export type SlotInput = z.infer<typeof slotSchema>;

export const examListQuery = z.object({
  status: z.enum(['draft', 'future', 'in_progress', 'completed']).optional(),
});
