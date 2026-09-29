import bcrypt from 'bcryptjs';
import { Queryable, pool, query, queryOne } from '../../db/pool';
import { badRequest, conflict, notFound } from '../../common/errors';
import { toUser, UserRow } from './users.mapper';
import { PatchStudentInput, ProfileInput } from './users.schema';

/** Digits only; a bare 10-digit number is treated as Indian (+91) so "+91 98765 43210" and "9876543210" match. */
export function phoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

export async function getUserById(id: string) {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  if (!row) throw notFound('User not found');
  return toUser(row);
}

async function assertContactFree(email: string | null, phone: string | null, exceptId: string | null, db: Queryable = pool) {
  const clash = await queryOne<{ email: string | null; phone_digits: string | null }>(
    `SELECT email, phone_digits FROM users
     WHERE ($1::uuid IS NULL OR id <> $1) AND (($2::text IS NOT NULL AND email = $2) OR ($3::text IS NOT NULL AND phone_digits = $3))
     LIMIT 1`,
    [exceptId, email, phoneDigits(phone)], db,
  );
  if (!clash) return;
  const field = email && clash.email === email ? 'email' : 'phone';
  const message = `This ${field} is already used by another account`;
  throw conflict(message, { [field]: [message] });
}

/** A profile as stored: admins may have no date of birth. */
type ProfileRecord = Omit<ProfileInput, 'dob'> & { dob: string | null };

const PROFILE_COLUMNS = `full_name, email, phone, phone_digits, date_of_birth, gender, school, grade, city, state, guardian_name, guardian_phone`;
const profileValues = (p: ProfileRecord) => [
  p.name, p.email, p.phone, phoneDigits(p.phone), p.dob, p.gender, p.school, p.grade, p.city, p.state, p.guardianName, p.guardianPhone,
];

export async function updateProfile(id: string, input: ProfileRecord) {
  await assertContactFree(input.email, input.phone, id);
  const row = await queryOne<UserRow>(
    `UPDATE users SET (${PROFILE_COLUMNS}, updated_at) = ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     WHERE id = $1 RETURNING *`,
    [id, ...profileValues(input)],
  );
  if (!row) throw notFound('User not found');
  return toUser(row);
}

/** Admin edit: merges the given fields over the current profile. */
export async function patchStudent(id: string, patch: PatchStudentInput) {
  const current = await queryOne<UserRow>(`SELECT * FROM users WHERE id = $1 AND role = 'student'`, [id]);
  if (!current) throw notFound('Student not found');
  const base = toUser(current);
  const merged: ProfileRecord = { ...base, ...patch };
  if (!merged.email && !merged.phone) throw badRequest('Validation failed', { email: ['Email or phone is required'] });
  return updateProfile(id, merged);
}

export type NewUserInput = Partial<Omit<ProfileInput, 'name'>> & { name: string; password: string };

/** Single place where accounts are created; the role is decided by the calling route, never by the request body. */
export async function createUser(input: NewUserInput, role: 'student' | 'admin') {
  const p: ProfileRecord = {
    name: input.name, email: input.email ?? null, phone: input.phone ?? null, dob: input.dob ?? null,
    gender: input.gender ?? null, school: input.school ?? null, grade: input.grade ?? null, city: input.city ?? null,
    state: input.state ?? null, guardianName: input.guardianName ?? null, guardianPhone: input.guardianPhone ?? null,
  };
  await assertContactFree(p.email, p.phone, null);
  const hash = await bcrypt.hash(input.password, 10);
  const row = await queryOne<UserRow>(
    `INSERT INTO users (${PROFILE_COLUMNS}, password_hash, role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [...profileValues(p), hash, role],
  );
  return toUser(row!);
}

export async function findUserByIdentifier(identifier: string) {
  const id = identifier.trim();
  return id.includes('@')
    ? queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [id.toLowerCase()])
    : queryOne<UserRow>('SELECT * FROM users WHERE phone_digits = $1', [phoneDigits(id)]);
}

/** Loads several users at once (for list screens). */
export async function findUsers(ids: string[]) {
  return query<UserRow>('SELECT * FROM users WHERE id = ANY($1)', [ids]);
}
