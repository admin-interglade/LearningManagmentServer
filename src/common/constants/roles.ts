export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
