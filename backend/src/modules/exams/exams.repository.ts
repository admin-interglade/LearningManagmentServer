import { Queryable, pool, query, queryOne } from '../../db/pool';
import { notFound } from '../../common/errors';
import { EXAM_STATUS_SQL, ExamStatus, PHASE_BY_STATUS } from '../../common/time';
import { Complexity, toApiComplexity } from '../../common/complexity';

interface ExamRow {
  id: string; title: string; description: string | null; age_min: number | null; age_max: number | null;
  registration_start: Date; registration_end: Date; exam_start: Date; exam_end: Date;
  duration_minutes: number; fee: number; currency: string; award: string | null; practice_attempts: number;
  practice_question_count: number; is_published: boolean; status: ExamStatus; registration_open: boolean;
  registered_count: number; created_at: Date;
}
interface LevelRow {
  id: string; exam_id: string; level_number: number; name: string; max_attempts: number;
  pass_percentage: number; duration_minutes: number;
}
interface SectionRow {
  id: string; level_id: string; position: number; category_id: string; category_name: string; complexity: Complexity;
  question_count: number; marks_per_question: number;
}
interface SlotRow { id: string; exam_id: string; level_id: string; start_at: Date; end_at: Date; capacity: number; booked_count: number }

const toSection = (s: SectionRow) => ({
  id: s.id, category: s.category_name, categoryId: s.category_id, complexity: toApiComplexity(s.complexity),
  questionCount: s.question_count, marksPerQuestion: s.marks_per_question,
});
export type Section = ReturnType<typeof toSection>;

const toLevel = (l: LevelRow, sections: Section[]) => ({
  id: l.id, order: l.level_number, name: l.name, attempts: l.max_attempts, durationMinutes: l.duration_minutes,
  passPercent: l.pass_percentage, sections,
  maxScore: sections.reduce((sum, s) => sum + s.questionCount * s.marksPerQuestion, 0),
});
export type ExamLevel = ReturnType<typeof toLevel>;

export const toSlot = (s: SlotRow) => ({
  id: s.id, levelId: s.level_id, startsAt: s.start_at, endsAt: s.end_at, capacity: s.capacity, bookedCount: s.booked_count ?? 0,
});
export type ExamSlot = ReturnType<typeof toSlot>;

const toExam = (e: ExamRow, levels: ExamLevel[], slots: ExamSlot[]) => ({
  id: e.id, title: e.title, description: e.description, award: e.award,
  ageGroupMin: e.age_min, ageGroupMax: e.age_max,
  registrationStart: e.registration_start, registrationEnd: e.registration_end,
  examStart: e.exam_start, examEnd: e.exam_end, durationMinutes: e.duration_minutes,
  registrationFee: e.fee, currency: e.currency, practiceAttempts: e.practice_attempts,
  practiceQuestionCount: e.practice_question_count, published: e.is_published,
  phase: PHASE_BY_STATUS[e.status], registrationOpen: e.registration_open, registeredCount: e.registered_count,
  levels, slots, createdAt: e.created_at,
});
export type Exam = ReturnType<typeof toExam>;

const EXAM_SELECT = `
  SELECT e.*, ${EXAM_STATUS_SQL} AS status,
    (e.is_published AND now() BETWEEN e.registration_start AND e.registration_end) AS registration_open,
    (SELECT count(*) FROM registrations r WHERE r.exam_id = e.id AND r.status = 'confirmed') AS registered_count
  FROM exams e`;

export const SLOT_SELECT = `
  SELECT s.*, (SELECT count(*) FROM registration_slots rs JOIN registrations r ON r.id = rs.registration_id
               WHERE rs.slot_id = s.id AND r.status = 'confirmed') AS booked_count
  FROM exam_slots s`;

/** Loads exams (with levels, sections and slots) matching an optional WHERE clause on alias `e`. */
export async function findExams(whereSql = '', params: unknown[] = [], orderSql = 'ORDER BY e.exam_start', db: Queryable = pool): Promise<Exam[]> {
  const rows = await query<ExamRow>(`SELECT * FROM (${EXAM_SELECT}) e ${whereSql} ${orderSql}`, params, db);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const loaders = [
    () => query<LevelRow>('SELECT * FROM exam_levels WHERE exam_id = ANY($1) ORDER BY level_number', [ids], db),
    () => query<SectionRow>(
      `SELECT s.*, c.name AS category_name FROM level_sections s
       JOIN exam_levels l ON l.id = s.level_id JOIN question_categories c ON c.id = s.category_id
       WHERE l.exam_id = ANY($1) ORDER BY s.position`, [ids], db),
    () => query<SlotRow>(`${SLOT_SELECT} WHERE s.exam_id = ANY($1) ORDER BY s.start_at`, [ids], db),
  ] as const;
  // A transaction client runs one query at a time; the pool can run them in parallel.
  const [levels, sections, slots] = (db === pool
    ? await Promise.all(loaders.map((load) => load()))
    : [await loaders[0](), await loaders[1](), await loaders[2]()]) as [LevelRow[], SectionRow[], SlotRow[]];
  return rows.map((r) => {
    const examLevels = levels.filter((l) => l.exam_id === r.id);
    const levelOrder = new Map(examLevels.map((l) => [l.id, l.level_number]));
    return toExam(
      r,
      examLevels.map((l) => toLevel(l, sections.filter((s) => s.level_id === l.id).map(toSection))),
      slots.filter((s) => s.exam_id === r.id)
        .sort((a, b) => (levelOrder.get(a.level_id)! - levelOrder.get(b.level_id)!) || +a.start_at - +b.start_at)
        .map(toSlot),
    );
  });
}

export async function findExamById(id: string, db: Queryable = pool): Promise<Exam> {
  const [exam] = await findExams('WHERE e.id = $1', [id], '', db);
  if (!exam) throw notFound('Exam not found');
  return exam;
}

export async function findSlotById(id: string, db: Queryable = pool) {
  const row = await queryOne<SlotRow>(`${SLOT_SELECT} WHERE s.id = $1`, [id], db);
  return row ? { ...toSlot(row), examId: row.exam_id } : null;
}

/** Status key used by list filters (`draft` | `future` | `in_progress` | `completed`). */
export const statusOf = (e: Pick<Exam, 'phase'>): ExamStatus =>
  (Object.keys(PHASE_BY_STATUS) as ExamStatus[]).find((k) => PHASE_BY_STATUS[k] === e.phase)!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Client ids that are not UUIDs can never exist in the database (e.g. unsaved draft rows). */
export const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);
