import { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { env } from '../../config/env';
import { AppError } from '../errors/app-error';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
    return;
  }

  if (err instanceof QueryFailedError) {
    const code = (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
    if (code === '23505') {
      res.status(409).json({ success: false, message: 'Duplicate value violates a unique constraint' });
      return;
    }
    if (code === '23503') {
      res.status(409).json({ success: false, message: 'Operation violates a foreign key constraint' });
      return;
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, message: 'Malformed JSON body' });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.isProduction ? {} : { error: err instanceof Error ? err.message : String(err) }),
  });
};
