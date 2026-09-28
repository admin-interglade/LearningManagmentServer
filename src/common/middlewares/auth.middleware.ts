import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { RoleName } from '../constants/roles';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthUser {
  userId: string;
  role: RoleName;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing bearer token');
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
};

export const authorize =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden('You do not have access to this resource');
    next();
  };

// Controllers behind `authenticate` can rely on req.user being set
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
};
