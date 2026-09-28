import { z } from 'zod';

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const mobile = z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Mobile must be 7-15 digits, optionally prefixed with +');

export const registerSchema = z
  .object({
    email: z.email().trim().toLowerCase().optional(),
    mobile: mobile.optional(),
    password,
    country_code: z.string().trim().toUpperCase().length(2, 'country_code must be an ISO-3166 alpha-2 code').default('IN'),
    profile: z.object({
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().max(100).optional(),
      school_name: z.string().trim().max(255).optional(),
      class_name: z.string().trim().max(100).optional(),
      contact_details: z.string().trim().max(1000).optional(),
    }),
  })
  .refine((b) => b.email || b.mobile, { message: 'Either email or mobile is required', path: ['email'] });
export type RegisterBody = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email_or_mobile: z.string().trim().min(3),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email_or_mobile: z.string().trim().min(3),
});
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  new_password: password,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: password,
  })
  .refine((b) => b.current_password !== b.new_password, {
    message: 'New password must differ from the current password',
    path: ['new_password'],
  });
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
