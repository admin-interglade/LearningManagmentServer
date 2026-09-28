import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, env.bcryptSaltRounds);

export const comparePassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

export const passwordFingerprint = (hash: string): string =>
  crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16);
