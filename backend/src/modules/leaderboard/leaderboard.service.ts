import { query } from '../../db/pool';
import { Exam } from '../exams/exams.repository';

export interface LeaderboardEntry {
  rank: number; userId: string; name: string; city: string | null; perLevel: Record<string, number>;
  total: number; maxTotal: number; levelsCleared: number; timeSeconds: number; isMe: boolean;
}

/**
 * Ranking = sum of the best real-attempt score per level (best = highest score, then fastest).
 * Ties: lower total time of those best attempts, then earlier registration.
 * Only confirmed students with at least one submitted real attempt are ranked.
 */
export async function getLeaderboard(exam: Pick<Exam, 'id' | 'levels'>, opts: { limit?: number; meId?: string } = {}): Promise<LeaderboardEntry[]> {
  const rows = await query(
    `WITH best AS (
       SELECT DISTINCT ON (a.user_id, a.level_id) a.user_id, a.level_id, a.score, a.max_score, a.time_taken_seconds
       FROM attempts a
       WHERE a.exam_id = $1 AND a.mode = 'real' AND a.status = 'submitted'
       ORDER BY a.user_id, a.level_id, a.score DESC, a.time_taken_seconds ASC
     ), agg AS (
       SELECT b.user_id, sum(b.score) AS total, sum(b.time_taken_seconds) AS time_seconds,
         count(*) FILTER (WHERE b.score * 100 >= l.pass_percentage * b.max_score) AS levels_cleared,
         jsonb_object_agg(b.level_id, b.score) AS per_level
       FROM best b JOIN exam_levels l ON l.id = b.level_id GROUP BY b.user_id
     )
     SELECT row_number() OVER (ORDER BY agg.total DESC, agg.time_seconds ASC, r.created_at ASC) AS rank,
       u.id AS user_id, u.full_name, u.city, agg.total, agg.time_seconds, agg.levels_cleared, agg.per_level
     FROM agg
     JOIN registrations r ON r.user_id = agg.user_id AND r.exam_id = $1 AND r.status = 'confirmed'
     JOIN users u ON u.id = agg.user_id
     ORDER BY rank
     ${opts.limit ? 'LIMIT $2' : ''}`,
    opts.limit ? [exam.id, opts.limit] : [exam.id],
  );
  const maxTotal = exam.levels.reduce((sum, l) => sum + l.maxScore, 0);
  return rows.map((r) => ({
    rank: r.rank, userId: r.user_id, name: r.full_name, city: r.city, perLevel: r.per_level,
    total: r.total, maxTotal, levelsCleared: r.levels_cleared, timeSeconds: r.time_seconds, isMe: r.user_id === opts.meId,
  }));
}
