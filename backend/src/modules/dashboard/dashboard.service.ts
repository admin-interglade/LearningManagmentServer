import { query, queryOne } from '../../db/pool';
import { Exam, findExams } from '../exams/exams.repository';
import { getLeaderboard } from '../leaderboard/leaderboard.service';

export async function getSummary() {
  const row = await queryOne(
    `SELECT
       (SELECT count(*) FROM users WHERE role = 'student') AS total_students,
       (SELECT count(*) FROM users WHERE role = 'student' AND created_at >= date_trunc('month', now())) AS new_students,
       (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'paid') AS revenue,
       (SELECT count(*) FROM registrations WHERE status = 'confirmed') AS registrations,
       (SELECT count(*) FROM attempts WHERE mode = 'real' AND status = 'submitted') AS papers,
       (SELECT count(*) FROM attempts WHERE mode = 'practice' AND status = 'submitted') AS practice,
       (SELECT count(*) FROM exams) AS exams_total,
       (SELECT count(*) FROM exams WHERE NOT is_published) AS exams_draft,
       (SELECT count(*) FROM exams WHERE is_published AND now() < exam_start) AS exams_future,
       (SELECT count(*) FROM exams WHERE is_published AND now() BETWEEN exam_start AND exam_end) AS exams_in_progress,
       (SELECT count(*) FROM exams WHERE is_published AND now() > exam_end) AS exams_completed`,
  );
  const byPhase = await query<{ phase: string; revenue: number }>(
    `SELECT CASE WHEN now() < e.exam_start THEN 'Future' WHEN now() > e.exam_end THEN 'Completed' ELSE 'In Progress' END AS phase,
       sum(p.amount) AS revenue
     FROM payments p JOIN registrations r ON r.id = p.registration_id JOIN exams e ON e.id = r.exam_id
     WHERE p.status = 'paid' AND e.is_published GROUP BY 1`,
  );
  const revenueByPhase: Record<string, number> = { Future: 0, 'In Progress': 0, Completed: 0 };
  for (const r of byPhase) revenueByPhase[r.phase] = r.revenue;
  return {
    totalStudents: row.total_students,
    newStudentsThisMonth: row.new_students,
    totalRevenue: row.revenue,
    registrations: row.registrations,
    papersSubmitted: row.papers,
    practicePapersTaken: row.practice,
    exams: {
      total: row.exams_total, draft: row.exams_draft, future: row.exams_future,
      inProgress: row.exams_in_progress, completed: row.exams_completed,
    },
    revenueByPhase,
  };
}

/** Aggregate for one exam: used by the dashboard drill-down and the exam report page. */
export async function examReport(exam: Exam) {
  const row = await queryOne(
    `SELECT
       (SELECT coalesce(sum(p.amount), 0) FROM payments p JOIN registrations r ON r.id = p.registration_id
        WHERE r.exam_id = $1 AND p.status = 'paid') AS revenue,
       (SELECT coalesce(sum(p.discount_amount), 0) FROM payments p JOIN registrations r ON r.id = p.registration_id
        WHERE r.exam_id = $1 AND p.status = 'paid') AS discount_given,
       (SELECT count(*) FROM attempts WHERE exam_id = $1 AND mode = 'real' AND status = 'submitted') AS papers,
       (SELECT avg(score * 100.0 / NULLIF(max_score, 0)) FROM attempts WHERE exam_id = $1 AND mode = 'real' AND status = 'submitted') AS avg_pct,
       (SELECT count(*) FROM registration_slots rs JOIN registrations r ON r.id = rs.registration_id
        WHERE r.exam_id = $1 AND r.status = 'confirmed') AS slots_booked`,
    [exam.id],
  );
  return {
    exam,
    registeredCount: exam.registeredCount,
    revenue: row.revenue,
    discountGiven: row.discount_given,
    papersSubmitted: row.papers,
    averageScorePercent: row.avg_pct === null ? null : Math.round(row.avg_pct),
    slotsBooked: row.slots_booked,
    slotCapacity: exam.slots.reduce((n, s) => n + s.capacity, 0),
    // Final for completed exams, current standings while in progress, nothing before it starts.
    topStudents: exam.phase === 'Future' || exam.phase === 'Draft' ? [] : await getLeaderboard(exam, { limit: 10 }),
  };
}

export async function getExamsByStatus(status: 'completed' | 'in_progress' | 'future') {
  const exams = await findExams('WHERE e.status = $1', [status], status === 'future' ? 'ORDER BY e.exam_start' : 'ORDER BY e.exam_start DESC');
  return Promise.all(exams.map(examReport));
}
