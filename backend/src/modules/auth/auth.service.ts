import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { query, queryOne, withTransaction } from '../../db/pool';
import { badRequest, unauthorized } from '../../common/errors';
import { signToken } from '../../common/auth.middleware';
import { toUser, UserRow } from '../users/users.mapper';
import { createUser, findUserByIdentifier } from '../users/users.service';
import { RegisterInput } from '../users/users.schema';
import { changePasswordSchema } from './auth.schema';
import { sendMail } from './mailer';

const RESET_TTL_MINUTES = 30;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const findByIdentifier = findUserByIdentifier;

export async function register(input: RegisterInput) {
  const user = await createUser(input, 'student');
  return { token: signToken({ id: user.id, role: user.role }), user };
}

export async function login(identifier: string, password: string) {
  const row = await findByIdentifier(identifier);
  if (!row || !row.is_active || !(await bcrypt.compare(password, row.password_hash))) {
    throw unauthorized('Invalid email/phone or password');
  }
  return { token: signToken({ id: row.id, role: row.role }), user: toUser(row) };
}

export async function forgotPassword(identifier: string) {
  const message = 'If an account exists, password reset instructions have been sent.';
  const row = await findByIdentifier(identifier);
  if (!row) return { message };

  const token = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [row.id, sha256(token), RESET_TTL_MINUTES],
  );
  const link = `${env.appUrl}/reset-password?token=${token}`;
  const text = `Hi ${row.full_name},\n\nReset your Interglade Talent password using this link (valid ${RESET_TTL_MINUTES} minutes):\n${link}\n\nIf you did not request this, ignore this message.`;
  if (row.email) await sendMail(row.email, 'Reset your Interglade Talent password', text);
  else console.log(`[sms:dev] to=${row.phone} ${link}`); // SMS provider: Phase 2

  return env.isProd ? { message } : { message, devResetToken: token };
}

export async function resetPassword(token: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await withTransaction(async (db) => {
    const reset = await queryOne<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [sha256(token)], db,
    );
    if (!reset) throw badRequest('This reset link is invalid or has expired');
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [reset.user_id, hash]);
    await db.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [reset.user_id]);
  });
  return { message: 'Password updated. You can now log in.' };
}

export async function changePassword(userId: string, input: z.infer<typeof changePasswordSchema>) {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!row || !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
    throw badRequest('Current password is incorrect');
  }
  await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [userId, await bcrypt.hash(input.newPassword, 10)]);
  return { message: 'Password changed successfully' };
}
