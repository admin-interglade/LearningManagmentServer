import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { RoleName } from '../constants/roles';

export interface AccessTokenPayload {
  sub: string;
  role: RoleName;
}

export interface ResetTokenPayload {
  sub: string;
  // Fingerprint of the current password hash so the token dies once the password changes
  pwd: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'] });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;

export const signResetToken = (payload: ResetTokenPayload): string =>
  jwt.sign(payload, env.jwt.resetSecret, { expiresIn: env.jwt.resetExpiresIn as SignOptions['expiresIn'] });

export const verifyResetToken = (token: string): ResetTokenPayload =>
  jwt.verify(token, env.jwt.resetSecret) as ResetTokenPayload;
