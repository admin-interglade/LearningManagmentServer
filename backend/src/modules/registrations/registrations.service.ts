import { Queryable, pool, query, queryOne, withTransaction } from '../../db/pool';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { ageOn, percent } from '../../common/time';
import { Exam, ExamLevel, findExams, findExamById, findSlotById } from '../exams/exams.repository';
import { priceFor } from '../discounts/discounts.service';
import { loadSettings } from '../payments/payment-settings.service';
import { confirmRegistration, createOrder, OrderInfo, PaymentRow, recordFreePayment, toPayment } from '../payments/payments.service';
import { getLeaderboard } from '../leaderboard/leaderboard.service';

interface RegistrationRow {
  id: string; exam_id: string; user_id: string; status: 'pending_payment' | 'confirmed' | 'cancelled';
  discount_id: string | null; created_at: Date; slot_by_level: Record<string, string>; payment: PaymentRow | null;
}

/** Latest payment wins, except that a paid one always beats later abandoned orders. */
const REG_SELECT = `
  SELECT r.*,
    (SELECT to_jsonb(p) FROM payments p WHERE p.registration_id = r.id
     ORDER BY (p.status = 'paid') DESC, p.created_at DESC LIMIT 1) AS payment,
    (SELECT coalesce(jsonb_object_agg(rs.level_id, rs.slot_id), '{}') FROM registration_slots rs
     WHERE rs.registration_id = r.id) AS slot_by_level
  FROM registrations r`;

const toRegistration = (r: RegistrationRow, exam: Exam) => ({
  id: r.id, examId: r.exam_id, studentId: r.user_id,
  status: (r.status === 'cancelled' ? 'cancelled' : 'active') as 'active' | 'cancelled',
  registeredAt: r.created_at,
  slotByLevel: r.slot_by_level,
  payment: r.payment ? toPayment(r.payment) : null,
  exam,
});
export type Registration = ReturnType<typeof toRegistration>;

const isPaid = (r: { payment: { status: string } | null }) => r.payment?.status === 'paid';

async function toRegistrations(rows: RegistrationRow[], db: Queryable = pool) {
  if (!rows.length) return [];
  const exams = await findExams('WHERE e.id = ANY($1)', [[...new Set(rows.map((r) => r.exam_id))]], '', db);
  const byId = new Map(exams.map((e) => [e.id, e]));
  return rows.map((r) => toRegistration(r, byId.get(r.exam_id)!));
}

async function loadOwnRow(userId: string, registrationId: string, db: Queryable = pool) {
  const row = await queryOne<RegistrationRow>(`${REG_SELECT} WHERE r.id = $1`, [registrationId], db);
  if (!row) throw notFound('Registration not found');
  if (row.user_id !== userId) throw forbidden();
  return row;
}

export async function listRegistrations(userId: string) {
  const rows = await query<RegistrationRow>(
    `SELECT r.* FROM (${REG_SELECT}) r JOIN exams e ON e.id = r.exam_id
     WHERE r.user_id = $1 AND r.status <> 'cancelled' ORDER BY e.exam_start`,
    [userId],
  );
  return toRegistrations(rows);
}

/** Admin student detail: every registration including cancelled ones. */
export async function listRegistrationsForUser(userId: string) {
  const rows = await query<RegistrationRow>(`${REG_SELECT} WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [userId]);
  return toRegistrations(rows);
}

export async function getRegistration(userId: string, registrationId: string) {
  const [reg] = await toRegistrations([await loadOwnRow(userId, registrationId)]);
  return reg;
}

export async function register(userId: string, examId: string, discountCode: string | null): Promise<{ registration: Registration; order: OrderInfo | null }> {
  const exam = await findExamById(examId);
  if (!exam.published) throw notFound('Exam not found');
  if (!exam.registrationOpen) throw badRequest('Registration for this exam is not open');

  const user = await queryOne<{ date_of_birth: string | null }>('SELECT date_of_birth FROM users WHERE id = $1', [userId]);
  if (!user?.date_of_birth) throw badRequest('Please add your date of birth in your profile before registering');
  const age = ageOn(user.date_of_birth, new Date(exam.examStart));
  const { ageGroupMin: min, ageGroupMax: max } = exam;
  if ((min !== null && age < min) || (max !== null && age > max)) {
    const range = min !== null && max !== null ? `ages ${min}–${max}` : min !== null ? `ages ${min} and above` : `ages up to ${max}`;
    throw badRequest(`This exam is for ${range}. Your age on the exam date will be ${age}.`);
  }

  const already = await queryOne(`SELECT id FROM registrations WHERE exam_id = $1 AND user_id = $2 AND status = 'confirmed'`, [examId, userId]);
  if (already) throw conflict('You are already registered for this exam');

  const price = await priceFor(examId, discountCode);
  if (price.total > 0 && !(await loadSettings()).enabled) {
    throw badRequest('Online payments are currently disabled. Please try again later.');
  }

  const registrationId = await withTransaction(async (db) => {
    const existing = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM registrations WHERE exam_id = $1 AND user_id = $2 FOR UPDATE', [examId, userId], db,
    );
    if (existing?.status === 'confirmed') throw conflict('You are already registered for this exam');
    const values = [price.gross, price.discountId, price.code, price.discount, price.tax, price.total];
    let id: string;
    if (existing) {
      id = existing.id;
      await db.query(
        `UPDATE registrations SET status='pending_payment', amount_base=$2, discount_id=$3, discount_code=$4,
           discount_amount=$5, tax_amount=$6, amount_payable=$7 WHERE id=$1`, [id, ...values]);
    } else {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO registrations (exam_id, user_id, amount_base, discount_id, discount_code, discount_amount, tax_amount, amount_payable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [examId, userId, ...values], db);
      id = row!.id;
    }
    if (price.total === 0) {
      await recordFreePayment(db, id, price);
      await confirmRegistration(db, id);
    }
    return id;
  });

  const order = price.total > 0 ? await createOrder(registrationId, price) : null;
  return { registration: await getRegistration(userId, registrationId), order };
}

/** One slot per level. Changing is allowed until the booked slot starts (or again once it has ended). */
export async function selectSlot(userId: string, registrationId: string, levelId: string, slotId: string) {
  await withTransaction(async (db) => {
    const reg = await queryOne<{ user_id: string; exam_id: string; status: string }>(
      'SELECT user_id, exam_id, status FROM registrations WHERE id = $1 FOR UPDATE', [registrationId], db,
    );
    if (!reg) throw notFound('Registration not found');
    if (reg.user_id !== userId) throw forbidden();
    if (reg.status !== 'confirmed') throw badRequest('Complete payment before booking a slot');

    const exam = await findExamById(reg.exam_id, db);
    const level = exam.levels.find((l) => l.id === levelId);
    if (!level) throw badRequest('Validation failed', { levelId: ['This level does not belong to the exam'] });
    const slot = exam.slots.find((s) => s.id === slotId);
    if (!slot || slot.levelId !== levelId) throw badRequest('Validation failed', { slotId: ['This slot is not for the selected level'] });

    const now = new Date();
    const current = await queryOne<{ slot_id: string }>(
      'SELECT slot_id FROM registration_slots WHERE registration_id = $1 AND level_id = $2', [registrationId, levelId], db,
    );
    if (current?.slot_id === slotId) return;
    if (current) {
      const booked = await findSlotById(current.slot_id, db);
      if (booked && new Date(booked.startsAt) <= now && now < new Date(booked.endsAt)) {
        throw badRequest('Your booked slot has already started and cannot be changed');
      }
    }
    if (new Date(slot.endsAt) <= now) throw badRequest('This slot has already ended');

    await db.query('SELECT id FROM exam_slots WHERE id = $1 FOR UPDATE', [slotId]); // serialise bookings per slot
    const fresh = await findSlotById(slotId, db);
    if (fresh!.bookedCount >= fresh!.capacity) throw conflict('This slot is full. Please choose another slot.');
    await db.query(
      `INSERT INTO registration_slots (registration_id, level_id, slot_id) VALUES ($1, $2, $3)
       ON CONFLICT (registration_id, level_id) DO UPDATE SET slot_id = EXCLUDED.slot_id, booked_at = now()`,
      [registrationId, levelId, slotId],
    );
  });
  return getRegistration(userId, registrationId);
}

// ---- Progress ----

interface AttemptRow {
  id: string; level_id: string; mode: 'practice' | 'real'; attempt_number: number; status: 'in_progress' | 'submitted';
  score: number | null; max_score: number; started_at: Date; submitted_at: Date | null; time_taken_seconds: number | null;
}

export const isPassed = (score: number, maxScore: number, passPercent: number) => score * 100 >= passPercent * maxScore;

/**
 * Per-level progress and the readable reasons shown to the student.
 * `lockReason` explains why a level is locked; `realBlockReason` why a real attempt cannot start right now.
 */
export async function computeProgress(exam: Exam, reg: { id: string; paid: boolean; slotByLevel: Record<string, string> }, db: Queryable = pool, now = new Date()) {
  const attempts = await query<AttemptRow>('SELECT * FROM attempts WHERE registration_id = $1 ORDER BY started_at', [reg.id], db);
  const practiceAttemptsUsed = attempts.filter((a) => a.mode === 'practice').length;
  let previous: { level: ExamLevel; passed: boolean } | null = null;

  const levels = exam.levels.map((level) => {
    const mine = attempts.filter((a) => a.level_id === level.id);
    const real = mine.filter((a) => a.mode === 'real');
    const scores = real.filter((a) => a.status === 'submitted').map((a) => a.score ?? 0);
    const bestScore = scores.length ? Math.max(...scores) : null;
    const passed = bestScore !== null && isPassed(bestScore, level.maxScore, level.passPercent);

    const lockReason = !reg.paid ? 'Payment not complete'
      : previous && !previous.passed ? `Clear Level ${previous.level.order} to unlock this level` : null;
    const slotId = reg.slotByLevel[level.id] ?? null;
    const slot = exam.slots.find((s) => s.id === slotId) ?? null;
    const openReal = real.find((a) => a.status === 'in_progress');
    const realBlockReason = lockReason
      ?? (now > new Date(exam.examEnd) ? 'The exam window has closed'
        : !openReal && real.length >= level.attempts ? `All ${level.attempts} attempts used — your best score stands`
        : !slot ? 'Book a slot for this level'
        : now < new Date(slot.startsAt) ? 'Your slot has not started yet'
        : now > new Date(slot.endsAt) && !openReal ? 'Your slot has ended'
        : null);
    previous = { level, passed };

    return {
      level, unlocked: lockReason === null, lockReason,
      realAttemptsUsed: real.length,
      realAttemptsLeft: Math.max(0, level.attempts - real.length),
      bestScore, maxScore: level.maxScore,
      bestPercentage: bestScore === null ? null : percent(bestScore, level.maxScore),
      passed, slotId,
      realBlockReason,
      attempts: mine.map((a) => ({
        id: a.id, mode: a.mode, attemptNumber: a.attempt_number, status: a.status, score: a.score, maxScore: a.max_score,
        startedAt: a.started_at, submittedAt: a.submitted_at, timeTakenSeconds: a.time_taken_seconds,
      })),
      inProgressAttemptId: (openReal ?? mine.find((a) => a.status === 'in_progress'))?.id ?? null,
    };
  });

  // The "current" level is the furthest one the student has unlocked.
  const current = [...levels].reverse().find((l) => l.unlocked) ?? levels[0];
  const realBlockReason = current ? current.realBlockReason : 'This exam has no levels yet';
  return {
    levels,
    practiceAttemptsUsed,
    practiceAttemptsLeft: Math.max(0, exam.practiceAttempts - practiceAttemptsUsed),
    canAttemptRealNow: realBlockReason === null,
    realBlockReason,
  };
}

export async function getRegistrationDetail(userId: string, registrationId: string) {
  const reg = await getRegistration(userId, registrationId);
  const progress = await computeProgress(reg.exam, { id: reg.id, paid: isPaid(reg), slotByLevel: reg.slotByLevel });
  let myRank = null;
  if (isPaid(reg)) {
    const board = await getLeaderboard(reg.exam, { meId: userId });
    const me = board.find((e) => e.isMe);
    if (me) myRank = { rank: me.rank, of: board.length, total: me.total, maxTotal: me.maxTotal };
  }
  return { ...reg, ...progress, myRank };
}

export async function getDashboard(userId: string) {
  const registrations = await listRegistrations(userId);
  const stats = await queryOne<{ sat: number; practice: number; avg: number | null }>(
    `SELECT count(*) FILTER (WHERE mode = 'real' AND status = 'submitted') AS sat,
       count(*) FILTER (WHERE mode = 'practice' AND status = 'submitted') AS practice,
       avg(score * 100.0 / NULLIF(max_score, 0)) FILTER (WHERE mode = 'real' AND status = 'submitted') AS avg
     FROM attempts WHERE user_id = $1`, [userId]);
  const confirmed = registrations.filter(isPaid);

  let bestRank: { rank: number; of: number; examId: string } | null = null;
  for (const r of confirmed) {
    const board = await getLeaderboard(r.exam, { meId: userId });
    const me = board.find((e) => e.isMe);
    if (me && (!bestRank || me.rank < bestRank.rank)) bestRank = { rank: me.rank, of: board.length, examId: r.examId };
  }

  return {
    registrations,
    stats: {
      registered: confirmed.length,
      inProgress: confirmed.filter((r) => r.exam.phase === 'In Progress').length,
      sat: stats!.sat,
      practiceTaken: stats!.practice,
      averageScorePercent: stats!.avg === null ? null : Math.round(stats!.avg),
      bestRank,
    },
  };
}

export async function getStudentLeaderboard(userId: string, examId: string) {
  const reg = await queryOne(`SELECT id FROM registrations WHERE exam_id = $1 AND user_id = $2 AND status = 'confirmed'`, [examId, userId]);
  if (!reg) throw forbidden('Rankings are visible to registered students of this exam');
  const exam = await findExamById(examId);
  const entries = await getLeaderboard(exam, { meId: userId });
  return { exam: { id: exam.id, title: exam.title, phase: exam.phase }, entries, me: entries.find((e) => e.isMe) ?? null };
}
