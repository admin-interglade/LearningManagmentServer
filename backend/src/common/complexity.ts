import { z } from 'zod';

/** Stored lowercase; the API speaks `Low` | `Medium` | `High`. */
export type Complexity = 'low' | 'medium' | 'high';
export type ApiComplexity = 'Low' | 'Medium' | 'High';

export const toApiComplexity = (c: Complexity | string): ApiComplexity =>
  (c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()) as ApiComplexity;

/** Accepts `Low`/`Medium`/`High` (any case) and yields the stored lowercase value. */
export const complexitySchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.enum(['low', 'medium', 'high'], 'Complexity must be Low, Medium or High'));
