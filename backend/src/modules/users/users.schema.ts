import { z } from 'zod';

/** International form as sent by the country-code picker, e.g. "+91 9876543210". Stored as sent. */
export const phoneSchema = z.string().trim()
  .regex(/^\+?[0-9][0-9 -]*$/, 'Enter a valid phone number')
  .refine((p) => { const n = p.replace(/\D/g, '').length; return n >= 10 && n <= 15; }, 'Enter a valid phone number (10-15 digits)');
export const emailSchema = z.email('Enter a valid email').trim().toLowerCase();
export const dobSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d) < new Date(), 'Enter a valid date of birth');
export const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(120);

/** Optional text: blank or missing becomes null. */
const optionalText = z.string().trim().max(200).nullish().transform((v) => (v ? v : null));
const optionalEmail = emailSchema.nullish().or(z.literal('').transform(() => null)).transform((v) => v ?? null);
const optionalPhone = phoneSchema.nullish().or(z.literal('').transform(() => null)).transform((v) => v ?? null);

const profileFields = {
  gender: optionalText, school: optionalText, grade: optionalText, city: optionalText, state: optionalText,
  guardianName: optionalText, guardianPhone: optionalPhone,
};

const contactRequired = (v: { email?: string | null; phone?: string | null }) => !!(v.email || v.phone);
const contactMessage = { message: 'Email or phone is required', path: ['email'] };

/** POST /auth/register and POST /admin/students. */
export const registerSchema = z.object({
  name: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  dob: dobSchema,
  ...profileFields,
}).refine(contactRequired, contactMessage);

/** PUT /profile: full replace, omitted optional fields become null. */
export const updateProfileSchema = z.object({
  name: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  dob: dobSchema,
  ...profileFields,
}).refine(contactRequired, contactMessage);

/** PATCH /admin/students/:id: any subset of the profile. */
export const patchStudentSchema = z.object({
  name: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  dob: dobSchema,
  ...profileFields,
}).partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof updateProfileSchema>;
export type PatchStudentInput = z.infer<typeof patchStudentSchema>;
