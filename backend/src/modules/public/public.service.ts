import { queryOne } from '../../db/pool';
import { notFound } from '../../common/errors';
import { findExamById, findExams } from '../exams/exams.repository';

/** All published exams, including completed ones (the home page lists concluded examinations too). */
export const listPublishedExams = () => findExams('WHERE e.is_published', [], 'ORDER BY e.exam_start');

export async function getPublicExam(id: string) {
  const exam = await findExamById(id);
  if (!exam.published) throw notFound('Exam not found');
  return exam;
}

/** Largest rupee amount mentioned in an award text, e.g. "Gold medal + ₹10,000 scholarship" → 10000. */
export function awardValue(award: string | null): number {
  const amounts = (award ?? '').match(/\d[\d,]*(\.\d+)?/g) ?? [];
  return Math.max(0, ...amounts.map((a) => Number(a.replace(/,/g, ''))).filter(Number.isFinite));
}

export async function getStats() {
  const row = await queryOne<{ students: number; exams: number; subjects: number; awards: (string | null)[] }>(
    `SELECT (SELECT count(*) FROM users WHERE role = 'student') AS students,
            (SELECT count(*) FROM exams WHERE is_published AND exam_end >= now()) AS exams,
            (SELECT count(DISTINCT s.category_id) FROM level_sections s JOIN exam_levels l ON l.id = s.level_id
             JOIN exams e ON e.id = l.exam_id WHERE e.is_published) AS subjects,
            (SELECT coalesce(array_agg(award), '{}') FROM exams WHERE is_published) AS awards`,
  );
  return { students: row!.students, exams: row!.exams, subjects: row!.subjects, topAward: Math.max(0, ...row!.awards.map(awardValue)) };
}
