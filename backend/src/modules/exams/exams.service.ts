import { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../../db/pool';
import { badRequest, conflict, notFound } from '../../common/errors';
import { ageOn } from '../../common/time';
import { ExamInput, LevelInput, SlotInput } from './exams.schema';
import { findExamById, findExams, findSlotById } from './exams.repository';

export async function listExams(status?: string) {
  return status
    ? findExams('WHERE e.status = $1', [status], 'ORDER BY e.exam_start DESC')
    : findExams('', [], 'ORDER BY e.exam_start DESC');
}

export const getExam = (id: string) => findExamById(id);

/** Maps section category names to ids; unknown names are reported against the exact field. */
async function resolveCategories(db: PoolClient, input: ExamInput) {
  const rows = await query<{ id: string; name: string }>('SELECT id, name FROM question_categories', [], db);
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
  const details: Record<string, string[]> = {};
  input.levels.forEach((l, i) => l.sections.forEach((s, j) => {
    if (!byName.has(s.category.toLowerCase())) details[`levels.${i}.sections.${j}.category`] = [`Unknown category "${s.category}"`];
  }));
  if (Object.keys(details).length) throw badRequest('Validation failed', details);
  return (name: string) => byName.get(name.toLowerCase())!;
}

const examParams = (i: ExamInput) => [
  i.title, i.description ?? null, i.ageGroupMin, i.ageGroupMax, i.registrationStart, i.registrationEnd, i.examStart, i.examEnd,
  i.durationMinutes, i.registrationFee, i.award ?? null, i.practiceAttempts, i.practiceQuestionCount,
];

async function writeSections(db: PoolClient, levelId: string, level: LevelInput, categoryId: (n: string) => string, keepIds: Set<string>) {
  await db.query('DELETE FROM level_sections WHERE level_id = $1', [levelId]);
  let position = 1;
  for (const s of level.sections) {
    const id = s.id && keepIds.has(s.id) ? s.id : null;
    await db.query(
      `INSERT INTO level_sections (id, level_id, position, category_id, complexity, question_count, marks_per_question)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)`,
      [id, levelId, position++, categoryId(s.category), s.complexity, s.questionCount, s.marksPerQuestion],
    );
  }
}

async function insertLevel(db: PoolClient, examId: string, l: LevelInput, examDuration: number) {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO exam_levels (exam_id, level_number, name, max_attempts, pass_percentage, duration_minutes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [examId, l.order, l.name, l.attempts, Math.round(l.passPercent), l.durationMinutes ?? examDuration], db,
  );
  return row!.id;
}

export async function createExam(input: ExamInput) {
  const id = await withTransaction(async (db) => {
    const categoryId = await resolveCategories(db, input);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO exams (title, description, age_min, age_max, registration_start, registration_end, exam_start, exam_end,
         duration_minutes, fee, award, practice_attempts, practice_question_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      examParams(input), db,
    );
    for (const l of input.levels) {
      const levelId = await insertLevel(db, row!.id, l, input.durationMinutes);
      await writeSections(db, levelId, l, categoryId, new Set());
    }
    return row!.id;
  });
  return findExamById(id);
}

export async function updateExam(id: string, input: ExamInput) {
  await withTransaction(async (db) => {
    const exists = await queryOne('SELECT id FROM exams WHERE id = $1 FOR UPDATE', [id], db);
    if (!exists) throw notFound('Exam not found');
    const categoryId = await resolveCategories(db, input);
    await db.query(
      `UPDATE exams SET title=$2, description=$3, age_min=$4, age_max=$5, registration_start=$6, registration_end=$7,
         exam_start=$8, exam_end=$9, duration_minutes=$10, fee=$11, award=$12, practice_attempts=$13,
         practice_question_count=$14, updated_at=now()
       WHERE id=$1`,
      [id, ...examParams(input)],
    );

    const existing = await query<{ id: string; level_number: number; attempts: number }>(
      `SELECT l.id, l.level_number, (SELECT count(*) FROM attempts a WHERE a.level_id = l.id) AS attempts
       FROM exam_levels l WHERE l.exam_id = $1`, [id], db,
    );
    const existingIds = new Set(existing.map((l) => l.id));
    const keep = new Set(input.levels.map((l) => l.id).filter((x): x is string => !!x && existingIds.has(x)));
    for (const l of existing) {
      if (keep.has(l.id)) continue;
      if (l.attempts > 0) throw conflict(`Level ${l.level_number} has attempts against it and cannot be deleted`);
      await db.query('DELETE FROM exam_levels WHERE id = $1', [l.id]);
    }

    const sectionIds = new Set((await query<{ id: string }>(
      'SELECT s.id FROM level_sections s JOIN exam_levels l ON l.id = s.level_id WHERE l.exam_id = $1', [id], db,
    )).map((s) => s.id));

    // Park level numbers to avoid unique (exam_id, level_number) clashes while re-ordering.
    await db.query('UPDATE exam_levels SET level_number = -level_number WHERE exam_id = $1', [id]);
    for (const l of input.levels) {
      let levelId: string;
      if (l.id && keep.has(l.id)) {
        levelId = l.id;
        await db.query(
          `UPDATE exam_levels SET level_number=$2, name=$3, max_attempts=$4, pass_percentage=$5, duration_minutes=$6 WHERE id=$1`,
          [levelId, l.order, l.name, l.attempts, Math.round(l.passPercent), l.durationMinutes ?? input.durationMinutes],
        );
      } else {
        levelId = await insertLevel(db, id, l, input.durationMinutes);
      }
      await writeSections(db, levelId, l, categoryId, sectionIds);
    }
  });
  return findExamById(id);
}

export async function deleteExam(id: string) {
  const regs = await queryOne<{ n: number }>('SELECT count(*) AS n FROM registrations WHERE exam_id = $1', [id]);
  if (regs!.n > 0) throw conflict('This exam has registrations and cannot be deleted. Unpublish it instead.');
  const row = await queryOne('DELETE FROM exams WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Exam not found');
  await query('UPDATE discounts SET exam_ids = array_remove(exam_ids, $1::uuid) WHERE $1::uuid = ANY(exam_ids)', [id]);
  return { ok: true };
}

export async function setPublished(id: string, isPublished: boolean) {
  const row = await queryOne('UPDATE exams SET is_published = $2, updated_at = now() WHERE id = $1 RETURNING id', [id, isPublished]);
  if (!row) throw notFound('Exam not found');
  return findExamById(id);
}

/** Student table on the admin exam page. */
export async function listRegistrations(examId: string) {
  const exam = await findExamById(examId);
  const rows = await query(
    `SELECT r.id, r.created_at, r.discount_code, r.amount_payable,
       u.id AS user_id, u.full_name, u.email, u.phone, u.city, u.date_of_birth,
       p.status AS pay_status, p.amount AS pay_amount,
       (SELECT coalesce(jsonb_object_agg(rs.level_id, rs.slot_id), '{}') FROM registration_slots rs WHERE rs.registration_id = r.id) AS slot_by_level
     FROM registrations r JOIN users u ON u.id = r.user_id
     LEFT JOIN LATERAL (SELECT status, amount FROM payments p WHERE p.registration_id = r.id ORDER BY p.created_at DESC LIMIT 1) p ON true
     WHERE r.exam_id = $1 AND r.status <> 'cancelled' ORDER BY r.created_at DESC`,
    [examId],
  );
  return rows.map((r) => ({
    id: r.id,
    student: {
      id: r.user_id, name: r.full_name, email: r.email, phone: r.phone, city: r.city,
      age: r.date_of_birth ? ageOn(r.date_of_birth, new Date(exam.examStart)) : null,
    },
    registeredAt: r.created_at,
    slotByLevel: r.slot_by_level as Record<string, string>,
    amountPaid: r.pay_status === 'paid' ? r.pay_amount : 0,
    discountCode: r.discount_code,
    paymentStatus: r.pay_status ?? 'pending',
  }));
}

// ---- Slots ----

async function assertSlot(examId: string, s: SlotInput) {
  const exam = await findExamById(examId);
  const level = exam.levels.find((l) => l.id === s.levelId);
  if (!level) throw badRequest('Validation failed', { levelId: ['This level does not belong to the exam'] });
  const endsAt = s.endsAt ?? new Date(Math.min(s.startsAt.getTime() + level.durationMinutes * 60_000, new Date(exam.examEnd).getTime()));
  if (s.startsAt < new Date(exam.examStart) || endsAt > new Date(exam.examEnd) || s.startsAt >= endsAt) {
    throw badRequest('Validation failed', { startsAt: ['Slot must fall within the exam window'] });
  }
  return endsAt;
}

export async function createSlot(examId: string, s: SlotInput) {
  const endsAt = await assertSlot(examId, s);
  const row = await queryOne<{ id: string }>(
    'INSERT INTO exam_slots (exam_id, level_id, start_at, end_at, capacity) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [examId, s.levelId, s.startsAt, endsAt, s.capacity],
  );
  return findSlotById(row!.id);
}

export async function updateSlot(slotId: string, s: SlotInput) {
  const current = await findSlotById(slotId);
  if (!current) throw notFound('Slot not found');
  if (s.levelId !== current.levelId && current.bookedCount > 0) throw conflict('Students have booked this slot; its level cannot change');
  const endsAt = await assertSlot(current.examId, s);
  if (s.capacity < current.bookedCount) {
    throw badRequest('Validation failed', { capacity: [`Capacity cannot be below the ${current.bookedCount} seats already booked`] });
  }
  await query('UPDATE exam_slots SET level_id=$2, start_at=$3, end_at=$4, capacity=$5 WHERE id=$1', [slotId, s.levelId, s.startsAt, endsAt, s.capacity]);
  return findSlotById(slotId);
}

export async function deleteSlot(slotId: string) {
  const current = await findSlotById(slotId);
  if (!current) throw notFound('Slot not found');
  const booked = await queryOne<{ n: number }>('SELECT count(*) AS n FROM registration_slots WHERE slot_id = $1', [slotId]);
  if (booked!.n > 0) throw conflict('Students have booked this slot; it cannot be deleted');
  await query('DELETE FROM exam_slots WHERE id = $1', [slotId]);
  return { ok: true };
}
