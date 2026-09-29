import { RequestHandler } from 'express';
import { z, ZodError, ZodType } from 'zod';
import { badRequest } from './errors';

/**
 * Per-field messages keyed by the field path, e.g. `{ "password": [...], "levels.0.sections.1.questionCount": [...] }`.
 * Errors on the object itself (no path) are reported under `_`.
 */
export function fieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(badRequest('Validation failed', fieldErrors(result.error)));
    req.body = result.data;
    next();
  };
}

export function parseQuery<T extends ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest('Invalid query parameters', fieldErrors(result.error));
  return result.data;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
