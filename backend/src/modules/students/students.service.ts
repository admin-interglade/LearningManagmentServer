import { query, queryOne } from '../../db/pool';
import { notFound } from '../../common/errors';
import { toUser, UserRow } from '../users/users.mapper';
import { listRegistrationsForUser } from '../registrations/registrations.service';

export async function listStudents(opts: { search?: string; page: number; pageSize: number }) {
  const params: unknown[] = [];
  let where = `WHERE u.role = 'student'`;
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where += ` AND (u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR u.city ILIKE $1 OR u.school ILIKE $1)`;
  }
  const total = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM users u ${where}`, params);
  const rows = await query<UserRow & { registrations_count: number; papers_submitted: number; total_paid: number }>(
    `SELECT u.*,
       (SELECT count(*) FROM registrations r WHERE r.user_id = u.id AND r.status = 'confirmed') AS registrations_count,
       (SELECT count(*) FROM attempts a WHERE a.user_id = u.id AND a.mode = 'real' AND a.status = 'submitted') AS papers_submitted,
       (SELECT coalesce(sum(p.amount), 0) FROM payments p JOIN registrations r ON r.id = p.registration_id
        WHERE r.user_id = u.id AND p.status = 'paid') AS total_paid
     FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, opts.pageSize, (opts.page - 1) * opts.pageSize],
  );
  return {
    items: rows.map((r) => ({
      ...toUser(r), registrationsCount: r.registrations_count, papersSubmitted: r.papers_submitted, totalPaid: r.total_paid,
    })),
    total: total!.n, page: opts.page, pageSize: opts.pageSize,
  };
}

/** Profile + registrations + submitted papers. */
export async function getStudent(id: string) {
  const row = await queryOne<UserRow>(`SELECT * FROM users WHERE id = $1 AND role = 'student'`, [id]);
  if (!row) throw notFound('Student not found');
  const papers = await query(
    `SELECT a.id, a.mode, a.exam_id, e.title AS exam_title, a.level_id, l.name AS level_name, a.attempt_number,
       a.score, a.max_score, a.started_at, a.submitted_at, a.time_taken_seconds
     FROM attempts a JOIN exams e ON e.id = a.exam_id JOIN exam_levels l ON l.id = a.level_id
     WHERE a.user_id = $1 AND a.status = 'submitted' ORDER BY a.submitted_at DESC`, [id],
  );
  return {
    user: toUser(row),
    registrations: await listRegistrationsForUser(id),
    papers: papers.map((a) => ({
      id: a.id, mode: a.mode, examId: a.exam_id, examTitle: a.exam_title, levelId: a.level_id, levelName: a.level_name,
      attemptNumber: a.attempt_number, score: a.score, maxScore: a.max_score, startedAt: a.started_at,
      submittedAt: a.submitted_at, timeTakenSeconds: a.time_taken_seconds,
    })),
  };
}
