import { PoolClient } from 'pg';
import { Queryable, pool, query, queryOne, withTransaction } from '../../db/pool';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { percent } from '../../common/time';
import { Complexity, toApiComplexity } from '../../common/complexity';
import { findExamById, Section } from '../exams/exams.repository';
import { computeProgress, isPassed } from '../registrations/registrations.service';
import { generateQuestions, Generator } from '../question-bank/generators';

/** Answers arriving slightly after expiry (network latency) are still accepted. */
const GRACE_SECONDS = 5;

interface AttemptRow {
  id: string; registration_id: string; user_id: string; exam_id: string; level_id: string; mode: 'practice' | 'real';
  attempt_number: number; status: 'in_progress' | 'submitted'; started_at: Date; expires_at: Date; submitted_at: Date | null;
  score: number | null; max_score: number; correct_count: number | null; wrong_count: number | null;
  unanswered_count: number | null; time_taken_seconds: number | null;
  exam_title: string; level_number: number; level_name: string; pass_percentage: number;
}
interface QuestionRow {
  position: number; text: string; options: string[]; correct_index: number; explanation: string | null; selected_index: number | null;
  category: string; complexity: Complexity; marks: number;
}

const ATTEMPT_SELECT = `
  SELECT a.*, e.title AS exam_title, l.level_number, l.name AS level_name, l.pass_percentage
  FROM attempts a JOIN exams e ON e.id = a.exam_id JOIN exam_levels l ON l.id = a.level_id`;

async function loadAttempt(attemptId: string, db: Queryable = pool) {
  const row = await queryOne<AttemptRow>(`${ATTEMPT_SELECT} WHERE a.id = $1`, [attemptId], db);
  if (!row) throw notFound('Attempt not found');
  return row;
}

const remainingSeconds = (a: { expires_at: Date }) => Math.max(0, Math.floor((new Date(a.expires_at).getTime() - Date.now()) / 1000));

/** Correct answers and explanations are only included once the attempt is submitted. */
async function toAttempt(a: AttemptRow, db: Queryable = pool) {
  const qs = await query<QuestionRow>(
    `SELECT position, text, options, correct_index, explanation, selected_index, category, complexity, marks
     FROM attempt_questions WHERE attempt_id = $1 ORDER BY position`,
    [a.id], db,
  );
  const submitted = a.status === 'submitted';
  return {
    id: a.id, mode: a.mode, registrationId: a.registration_id, examId: a.exam_id, examTitle: a.exam_title,
    levelId: a.level_id, levelOrder: a.level_number, levelName: a.level_name, attemptNumber: a.attempt_number, status: a.status,
    startedAt: a.started_at, expiresAt: a.expires_at, remainingSeconds: submitted ? 0 : remainingSeconds(a), submittedAt: a.submitted_at,
    questions: qs.map((q) => ({
      position: q.position, text: q.text, options: q.options, selectedIndex: q.selected_index,
      category: q.category, complexity: toApiComplexity(q.complexity), marks: q.marks,
      ...(submitted ? { correctIndex: q.correct_index, explanation: q.explanation } : {}),
    })),
    result: submitted ? {
      score: a.score!, maxScore: a.max_score, percentage: percent(a.score!, a.max_score),
      correct: a.correct_count!, wrong: a.wrong_count!, unanswered: a.unanswered_count!,
      timeTakenSeconds: a.time_taken_seconds!,
      passed: isPassed(a.score!, a.max_score, a.pass_percentage),
    } : null,
  };
}

const isExpired = (a: { expires_at: Date }, graceSeconds = 0) => Date.now() > new Date(a.expires_at).getTime() + graceSeconds * 1000;

/** Scores and closes an attempt: score = Σ marks of correct answers. Caller must hold a row lock on the attempt. */
async function finalize(db: PoolClient, attemptId: string) {
  await db.query(
    `WITH s AS (
       SELECT count(*) FILTER (WHERE q.selected_index = q.correct_index) AS correct,
              count(*) FILTER (WHERE q.selected_index IS NOT NULL AND q.selected_index <> q.correct_index) AS wrong,
              count(*) FILTER (WHERE q.selected_index IS NULL) AS unanswered,
              coalesce(sum(q.marks) FILTER (WHERE q.selected_index = q.correct_index), 0) AS score
       FROM attempt_questions q WHERE q.attempt_id = $1
     )
     UPDATE attempts a SET status = 'submitted', submitted_at = LEAST(now(), a.expires_at),
       correct_count = s.correct, wrong_count = s.wrong, unanswered_count = s.unanswered, score = s.score,
       time_taken_seconds = GREATEST(0, EXTRACT(EPOCH FROM (LEAST(now(), a.expires_at) - a.started_at))::int)
     FROM s
     WHERE a.id = $1 AND a.status = 'in_progress'`,
    [attemptId],
  );
}

async function lockOwnAttempt(db: PoolClient, userId: string, attemptId: string) {
  const row = await queryOne<{ user_id: string; status: string; expires_at: Date }>(
    'SELECT user_id, status, expires_at FROM attempts WHERE id = $1 FOR UPDATE', [attemptId], db,
  );
  if (!row) throw notFound('Attempt not found');
  if (row.user_id !== userId) throw forbidden();
  return row;
}

/** Splits `total` questions across sections in proportion to their size (largest remainder). */
export function allocate(sections: Pick<Section, 'questionCount'>[], total: number): number[] {
  const sum = sections.reduce((n, s) => n + s.questionCount, 0);
  const raw = sections.map((s) => (total * s.questionCount) / sum);
  const counts = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0, left = total - counts.reduce((a, b) => a + b, 0); k < left; k++) counts[order[k % order.length][1]]++;
  return counts;
}

async function buildPaper(db: PoolClient, sections: Section[], counts: number[]) {
  const categories = await query<{ id: string; name: string; generator: Generator }>(
    'SELECT id, name, generator FROM question_categories WHERE id = ANY($1)', [sections.map((s) => s.categoryId)], db,
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  const paper = [];
  for (const [i, s] of sections.entries()) {
    if (!counts[i]) continue;
    const complexity = s.complexity.toLowerCase() as Complexity;
    const qs = await generateQuestions(byId.get(s.categoryId)!, complexity, counts[i], db);
    paper.push(...qs.map((q) => ({ ...q, sourceQuestionId: q.sourceQuestionId ?? null, category: s.category, complexity, marks: s.marksPerQuestion })));
  }
  return paper;
}

export async function startAttempt(userId: string, input: { registrationId: string; levelId: string; mode: 'practice' | 'real' }) {
  const attemptId = await withTransaction(async (db) => {
    // Lock the registration so concurrent "start" clicks cannot exceed attempt limits.
    const reg = await queryOne<{ id: string; user_id: string; exam_id: string; status: string }>(
      'SELECT id, user_id, exam_id, status FROM registrations WHERE id = $1 FOR UPDATE', [input.registrationId], db,
    );
    if (!reg) throw notFound('Registration not found');
    if (reg.user_id !== userId) throw forbidden();
    if (reg.status !== 'confirmed') throw badRequest('Payment not complete');

    const exam = await findExamById(reg.exam_id, db);
    const level = exam.levels.find((l) => l.id === input.levelId);
    if (!level) throw notFound('Level not found in this exam');

    const open = await queryOne<{ id: string; expires_at: Date }>(
      `SELECT id, expires_at FROM attempts WHERE registration_id = $1 AND level_id = $2 AND mode = $3 AND status = 'in_progress'`,
      [reg.id, level.id, input.mode], db,
    );
    if (open && !isExpired(open)) return open.id; // resume after refresh
    if (open) await finalize(db, open.id);

    const slots = await query<{ level_id: string; slot_id: string }>(
      'SELECT level_id, slot_id FROM registration_slots WHERE registration_id = $1', [reg.id], db,
    );
    const progress = await computeProgress(exam, { id: reg.id, paid: true, slotByLevel: Object.fromEntries(slots.map((s) => [s.level_id, s.slot_id])) }, db);
    const lp = progress.levels.find((p) => p.level.id === level.id)!;

    let counts = level.sections.map((s) => s.questionCount);
    let attemptNumber: number;
    if (input.mode === 'practice') {
      if (new Date() > new Date(exam.examEnd)) throw badRequest('The exam window has closed');
      if (progress.practiceAttemptsLeft <= 0) throw conflict(`All ${exam.practiceAttempts} practice attempts used`);
      counts = allocate(level.sections, exam.practiceQuestionCount);
      attemptNumber = progress.practiceAttemptsUsed + 1;
    } else {
      if (lp.unlocked && lp.realAttemptsLeft <= 0) throw conflict(`All ${level.attempts} attempts used — your best score stands`);
      if (lp.realBlockReason) throw badRequest(lp.realBlockReason);
      attemptNumber = lp.realAttemptsUsed + 1;
    }

    const paper = await buildPaper(db, level.sections, counts);
    const maxScore = paper.reduce((n, q) => n + q.marks, 0);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO attempts (registration_id, user_id, exam_id, level_id, mode, attempt_number, expires_at, max_score)
       VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(mins => $7), $8) RETURNING id`,
      [reg.id, userId, exam.id, level.id, input.mode, attemptNumber, level.durationMinutes, maxScore], db,
    );
    await db.query(
      `INSERT INTO attempt_questions (attempt_id, position, text, options, correct_index, explanation, source_question_id, category, complexity, marks)
       SELECT $1, t.ord, t.q->>'text', t.q->'options', (t.q->>'correctIndex')::int, t.q->>'explanation',
         (t.q->>'sourceQuestionId')::uuid, t.q->>'category', t.q->>'complexity', (t.q->>'marks')::int
       FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS t(q, ord)`,
      [row!.id, JSON.stringify(paper)],
    );
    return row!.id;
  });
  return toAttempt(await loadAttempt(attemptId));
}

export async function getAttempt(userId: string, attemptId: string) {
  const a = await loadAttempt(attemptId);
  if (a.user_id !== userId) throw forbidden();
  if (a.status === 'in_progress' && isExpired(a)) {
    await withTransaction(async (db) => { await lockOwnAttempt(db, userId, attemptId); await finalize(db, attemptId); });
    return toAttempt(await loadAttempt(attemptId));
  }
  return toAttempt(a);
}

export async function saveAnswer(userId: string, attemptId: string, position: number, selectedIndex: number | null) {
  const result = await withTransaction(async (db) => {
    const a = await lockOwnAttempt(db, userId, attemptId);
    if (a.status !== 'in_progress') return { error: conflict('This attempt has already been submitted') };
    if (isExpired(a, GRACE_SECONDS)) {
      await finalize(db, attemptId); // committed before the 409 is returned
      return { error: conflict('Time is up. Your attempt has been submitted automatically.') };
    }
    const q = await queryOne<{ n: number }>(
      'SELECT jsonb_array_length(options) AS n FROM attempt_questions WHERE attempt_id = $1 AND position = $2', [attemptId, position], db,
    );
    if (!q) throw badRequest('Validation failed', { position: ['Invalid question number'] });
    if (selectedIndex !== null && selectedIndex >= q.n) throw badRequest('Validation failed', { selectedIndex: ['Invalid option'] });
    await db.query(
      `UPDATE attempt_questions SET selected_index = $3, answered_at = CASE WHEN $3::int IS NULL THEN NULL ELSE now() END
       WHERE attempt_id = $1 AND position = $2`,
      [attemptId, position, selectedIndex],
    );
    return { ok: true as const, remainingSeconds: remainingSeconds(a) };
  });
  if ('error' in result) throw result.error;
  return result;
}

export async function submitAttempt(userId: string, attemptId: string) {
  await withTransaction(async (db) => {
    const a = await lockOwnAttempt(db, userId, attemptId);
    if (a.status === 'in_progress') await finalize(db, attemptId);
  });
  return toAttempt(await loadAttempt(attemptId));
}
