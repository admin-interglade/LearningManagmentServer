import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { toSkipTake } from '../../common/utils/pagination';
import { Result } from './entities/result.entity';
import { Leaderboard } from './entities/leaderboard.entity';
import { LevelQuestion } from '../questions/entities/level-question.entity';

export const resultsRepository = {
  findByAttempt: (attemptId: string, manager?: EntityManager) => repo(Result, manager).findOne({ where: { attemptId } }),

  create: (data: Partial<Result>, manager: EntityManager) => repo(Result, manager).save(repo(Result, manager).create(data)),

  averageForStudent: async (studentId: string, examId: string, manager: EntityManager) => {
    const row = await repo(Result, manager)
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .where('r.studentId = :studentId AND r.examId = :examId', { studentId, examId })
      .getRawOne<{ avg: string | null }>();
    return Number(row?.avg ?? 0);
  },

  // Marks config for every question linked to this level (even ones deactivated after the paper was drawn)
  findScoringLinks: (levelId: string, manager: EntityManager) =>
    repo(LevelQuestion, manager)
      .createQueryBuilder('lq')
      .innerJoinAndSelect('lq.levelCategory', 'category')
      .where('category.levelId = :levelId', { levelId })
      .getMany(),

  // Serialize leaderboard rebuilds per exam so concurrent submits don't race on the upsert
  lockExamLeaderboard: (examId: string, manager: EntityManager) =>
    manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`leaderboard:${examId}`]),

  /**
   * best_score = sum of the student's best score on each level of the exam,
   * average_score = mean of all their level results (also used as the tie-breaker).
   * RANK() gives equal rank to exact ties (1, 2, 2, 4).
   */
  rebuildLeaderboard: async (examId: string, manager: EntityManager) => {
    await manager.query(
      `
      WITH best AS (
        SELECT student_id, level_id, MAX(score) AS score
        FROM results WHERE exam_id = $1
        GROUP BY student_id, level_id
      ),
      agg AS (
        SELECT b.student_id,
               SUM(b.score) AS best_score,
               (SELECT ROUND(AVG(r.score), 2) FROM results r WHERE r.exam_id = $1 AND r.student_id = b.student_id) AS average_score
        FROM best b
        GROUP BY b.student_id
      ),
      ranked AS (
        SELECT *, RANK() OVER (ORDER BY best_score DESC, average_score DESC) AS rnk FROM agg
      )
      INSERT INTO leaderboards (exam_id, student_id, best_score, average_score, rank, tie_break_value, published_at)
      SELECT $1, student_id, best_score, average_score, rnk, average_score, now() FROM ranked
      ON CONFLICT (exam_id, student_id) DO UPDATE SET
        best_score = EXCLUDED.best_score,
        average_score = EXCLUDED.average_score,
        rank = EXCLUDED.rank,
        tie_break_value = EXCLUDED.tie_break_value,
        published_at = EXCLUDED.published_at
      `,
      [examId],
    );
    await manager.query(
      `UPDATE results r SET rank = l.rank
       FROM leaderboards l
       WHERE l.exam_id = r.exam_id AND l.student_id = r.student_id AND r.exam_id = $1`,
      [examId],
    );
  },

  listLeaderboard: (examId: string, page: number, size: number) => {
    const { skip, take } = toSkipTake({ page, size });
    return repo(Leaderboard)
      .createQueryBuilder('lb')
      .innerJoin('lb.student', 'student')
      .leftJoin('student.profile', 'profile')
      .addSelect(['student.userId', 'profile.firstName', 'profile.lastName', 'profile.schoolName'])
      .where('lb.examId = :examId', { examId })
      .orderBy('lb.rank', 'ASC')
      .addOrderBy('lb.publishedAt', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  },

  findLeaderboardEntry: (examId: string, studentId: string) =>
    repo(Leaderboard).findOne({ where: { examId, studentId } }),

  findLeaderboardByStudent: (studentId: string) =>
    repo(Leaderboard).find({ where: { studentId }, relations: { exam: true }, order: { publishedAt: 'DESC' } }),

  findByStudent: (studentId: string) =>
    repo(Result).find({ where: { studentId }, relations: { level: true, exam: true }, order: { createdAt: 'DESC' } }),

  topForExam: (examId: string, limit: number) =>
    repo(Leaderboard)
      .createQueryBuilder('lb')
      .innerJoin('lb.student', 'student')
      .leftJoin('student.profile', 'profile')
      .addSelect(['student.userId', 'student.email', 'student.mobile', 'profile.firstName', 'profile.lastName'])
      .where('lb.examId = :examId', { examId })
      .orderBy('lb.rank', 'ASC')
      .limit(limit)
      .getMany(),

  levelStats: (examId: string) =>
    repo(Result)
      .createQueryBuilder('r')
      .innerJoin('r.level', 'level')
      .select('level.levelId', 'level_id')
      .addSelect('level.levelNumber', 'level_number')
      .addSelect('level.name', 'level_name')
      .addSelect('COUNT(*)::int', 'results')
      .addSelect('ROUND(AVG(r.score), 2)::float', 'average_score')
      .addSelect('MAX(r.score)::float', 'highest_score')
      .addSelect('MIN(r.score)::float', 'lowest_score')
      .addSelect('ROUND(AVG(r.unattemptedCount), 2)::float', 'average_unattempted')
      .where('r.examId = :examId', { examId })
      .groupBy('level.levelId')
      .addGroupBy('level.levelNumber')
      .addGroupBy('level.name')
      .orderBy('level.levelNumber', 'ASC')
      .getRawMany(),
};
