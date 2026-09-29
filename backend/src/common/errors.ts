export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: unknown) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have access to this resource') => new AppError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Not found') => new AppError(404, message, 'NOT_FOUND');
export const conflict = (message: string, details?: unknown) => new AppError(409, message, 'CONFLICT', details);
