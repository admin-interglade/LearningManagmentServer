import { z } from 'zod';
import { emailSchema, nameSchema, phoneSchema } from '../users/users.schema';

export { registerSchema } from '../users/users.schema';

export const password = z.string().min(8, 'Password must be at least 8 characters').max(100);

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone'),
  password: z.string().min(1, 'Enter your password'),
});
export const forgotSchema = z.object({ identifier: z.string().trim().min(3, 'Enter your email or phone') });
/** `identifier` is accepted for the current form but not needed: the token identifies the account. */
export const resetSchema = z.object({ identifier: z.string().optional(), token: z.string().min(10, 'Invalid reset token'), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password });

export const createAdminSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  password,
});
