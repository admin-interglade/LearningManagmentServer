import { query } from '../../db/pool';
import { toUser, UserRow } from '../users/users.mapper';
import { createUser, NewUserInput } from '../users/users.service';

export async function listAdmins() {
  const rows = await query<UserRow>(`SELECT * FROM users WHERE role = 'admin' ORDER BY created_at`);
  return rows.map(toUser);
}

export const createAdmin = (input: NewUserInput) => createUser(input, 'admin');
