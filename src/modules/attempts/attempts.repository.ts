import { EntityManager, In } from 'typeorm';
import { repo } from '../../common/utils/db';
import { ATTEMPT_STATUS } from '../../common/constants/statuses';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { AttemptQuestion } from './entities/attempt-question.entity';

type LockMode = 'pessimistic_read' | 'pessimistic_write';

export const attemptsRepository = {
  findById: (attemptId: string, manager?: EntityManager, lock?: LockMode) =>
    repo(ExamAttempt, manager).findOne({ where: { attemptId }, ...(lock ? { lock: { mode: lock } } : {}) }),

  // Separate from the locking read: Postgres can't lock the nullable side of an outer join
  findWithContext: (attemptId: string, manager?: EntityManager) =>
    repo(ExamAttempt, manager).findOne({
      where: { attemptId },
      relations: { registration: true, level: { exam: true } },
    }),

  findInProgress: (registrationId: string, levelId: string, manager?: EntityManager) =>
    repo(ExamAttempt, manager).findOne({ where: { registrationId, levelId, status: ATTEMPT_STATUS.IN_PROGRESS } }),

  countForLevel: (registrationId: string, levelId: string, manager?: EntityManager) =>
    repo(ExamAttempt, manager).count({ where: { registrationId, levelId } }),

  create: (data: Partial<ExamAttempt>, manager: EntityManager) =>
    repo(ExamAttempt, manager).save(repo(ExamAttempt, manager).create(data)),

  save: (attempt: ExamAttempt, manager?: EntityManager) => repo(ExamAttempt, manager).save(attempt),

  createQuestions: (rows: Partial<AttemptQuestion>[], manager: EntityManager) =>
    repo(AttemptQuestion, manager).save(rows.map((r) => repo(AttemptQuestion, manager).create(r))),

  findQuestions: (attemptId: string, manager?: EntityManager) =>
    repo(AttemptQuestion, manager).find({
      where: { attemptId },
      relations: { question: { options: true } },
      order: { questionOrder: 'ASC' },
    }),

  findQuestion: (attemptId: string, attemptQuestionId: string, manager?: EntityManager) =>
    repo(AttemptQuestion, manager).findOne({
      where: { attemptId, attemptQuestionId },
      relations: { question: { options: true } },
    }),

  findQuestionsByIds: (attemptId: string, ids: string[], manager: EntityManager) =>
    repo(AttemptQuestion, manager).find({
      where: { attemptId, attemptQuestionId: In(ids) },
      relations: { question: { options: true } },
    }),

  saveQuestion: (row: AttemptQuestion, manager?: EntityManager) => repo(AttemptQuestion, manager).save(row),

  saveQuestions: (rows: AttemptQuestion[], manager: EntityManager) => repo(AttemptQuestion, manager).save(rows),

  findByStudent: (studentId: string) =>
    repo(ExamAttempt)
      .createQueryBuilder('attempt')
      .innerJoin('attempt.registration', 'registration')
      .innerJoinAndSelect('attempt.level', 'level')
      .innerJoin('level.exam', 'exam')
      .addSelect(['exam.examId', 'exam.name'])
      .where('registration.studentId = :studentId', { studentId })
      .orderBy('attempt.startedAt', 'DESC')
      .getMany(),
};
