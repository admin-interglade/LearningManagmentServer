import { NextFunction, Request, Response } from 'express';
import { z, ZodType } from 'zod';
import { AppError } from '../errors/app-error';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Parsed values replace the raw ones so controllers receive coerced, typed input
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        throw AppError.badRequest(`Invalid request ${key}`, z.flattenError(result.error));
      }
      if (key === 'query') {
        // Express 5 exposes req.query as a getter
        Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
      } else {
        req[key] = result.data as never;
      }
    }
    next();
  };

export const uuidParam = (...names: string[]) =>
  z.object(Object.fromEntries(names.map((n) => [n, z.uuid({ message: `${n} must be a valid UUID` })])));
