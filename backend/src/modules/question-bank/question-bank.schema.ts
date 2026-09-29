import { z } from 'zod';
import { paginationSchema } from '../../common/validate';
import { complexitySchema } from '../../common/complexity';

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullish(),
  generator: z.enum(['maths', 'reasoning', 'bank']),
});

export const questionSchema = z.object({
  categoryId: z.uuid(),
  complexity: complexitySchema,
  text: z.string().trim().min(3).max(2000),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().max(1000).nullish(),
}).refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, { message: 'Options must be distinct', path: ['options'] });

export const questionListQuery = paginationSchema.extend({
  categoryId: z.uuid().optional(),
  complexity: complexitySchema.optional(),
  search: z.string().trim().optional(),
});

export const previewSchema = z.object({
  categoryId: z.uuid(),
  complexity: complexitySchema,
  count: z.number().int().min(1).max(20).default(5),
});
