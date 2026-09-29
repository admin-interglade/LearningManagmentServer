export interface UserRow {
  id: string; role: 'student' | 'admin'; full_name: string; email: string | null; phone: string | null;
  password_hash: string; date_of_birth: string | null; gender: string | null; school: string | null;
  grade: string | null; city: string | null; state: string | null; guardian_name: string | null;
  guardian_phone: string | null; is_active: boolean; created_at: Date;
}

/** Public user shape. Never includes the password hash or any other secret. */
export function toUser(r: UserRow) {
  return {
    id: r.id, role: r.role, name: r.full_name, email: r.email, phone: r.phone, dob: r.date_of_birth,
    gender: r.gender, school: r.school, grade: r.grade, city: r.city, state: r.state,
    guardianName: r.guardian_name, guardianPhone: r.guardian_phone, createdAt: r.created_at,
  };
}
export type User = ReturnType<typeof toUser>;
