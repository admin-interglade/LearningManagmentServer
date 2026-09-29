import { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }
  // Postgres unique violation / invalid uuid
  if (err?.code === '23505') {
    res.status(409).json({ error: { message: 'A record with these details already exists', code: 'CONFLICT' } });
    return;
  }
  if (err?.code === '23503') {
    res.status(409).json({ error: { message: 'This record is still referenced by other data', code: 'CONFLICT' } });
    return;
  }
  if (err?.code === '22P02') {
    res.status(400).json({ error: { message: 'Invalid identifier', code: 'BAD_REQUEST' } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Malformed JSON body', code: 'BAD_REQUEST' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong', code: 'INTERNAL' } });
};
