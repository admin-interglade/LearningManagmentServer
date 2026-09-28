import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { PracticeTest } from './entities/practice-test.entity';
import { PracticeAttempt } from './entities/practice-attempt.entity';
import { LevelCategory } from '../exams/entities/level-category.entity';

export const practiceRepository = {
  findTestByExam: (examId: string) => repo(PracticeTest).findOne({ where: { examId } }),

  findTestById: (practiceTestId: string, manager?: EntityManager) =>
    repo(PracticeTest, manager).findOne({ where: { practiceTestId }, relations: { exam: true } }),

  saveTest: (data: Partial<PracticeTest>) => repo(PracticeTest).save(repo(PracticeTest).create(data)),

  countAttempts: (practiceTestId: string, studentId: string, manager?: EntityManager) =>
    repo(PracticeAttempt, manager).count({ where: { practiceTestId, studentId } }),

  findInProgress: (practiceTestId: string, studentId: string, manager?: EntityManager) =>
    repo(PracticeAttempt, manager).findOne({ where: { practiceTestId, studentId, status: 'in_progress' } }),

  createAttempt: (data: Partial<PracticeAttempt>, manager: EntityManager) =>
    repo(PracticeAttempt, manager).save(repo(PracticeAttempt, manager).create(data)),

  findAttemptForUpdate: (practiceAttemptId: string, manager: EntityManager) =>
    repo(PracticeAttempt, manager).findOne({ where: { practiceAttemptId }, lock: { mode: 'pessimistic_write' } }),

  saveAttempt: (attempt: PracticeAttempt, manager?: EntityManager) => repo(PracticeAttempt, manager).save(attempt),

  findAttemptsByStudent: (studentId: string) =>
    repo(PracticeAttempt).find({
      where: { studentId },
      relations: { practiceTest: { exam: true } },
      order: { startedAt: 'DESC' },
    }),

  // Every category across all levels of the exam feeds the practice question pool
  findCategoryIdsForExam: async (examId: string, manager?: EntityManager) =>
    (
      await repo(LevelCategory, manager)
        .createQueryBuilder('c')
        .innerJoin('c.level', 'level')
        .where('level.examId = :examId', { examId })
        .select('c.levelCategoryId', 'id')
        .getRawMany<{ id: string }>()
    ).map((r) => r.id),
};
