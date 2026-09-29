export type ExamStatus = 'draft' | 'future' | 'in_progress' | 'completed';
export type ExamPhase = 'Draft' | 'Future' | 'In Progress' | 'Completed';

export const PHASE_BY_STATUS: Record<ExamStatus, ExamPhase> = {
  draft: 'Draft', future: 'Future', in_progress: 'In Progress', completed: 'Completed',
};

/** Age in whole years on a given date. `dob` is 'YYYY-MM-DD'. */
export function ageOn(dob: string, on: Date): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = on.getUTCFullYear() - y;
  const beforeBirthday = on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** SQL fragment computing exam status for alias `e`. */
export const EXAM_STATUS_SQL = `CASE WHEN NOT e.is_published THEN 'draft'
  WHEN now() < e.exam_start THEN 'future'
  WHEN now() > e.exam_end THEN 'completed'
  ELSE 'in_progress' END`;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const percent = (score: number, max: number) => (max > 0 ? round2((score * 100) / max) : 0);
