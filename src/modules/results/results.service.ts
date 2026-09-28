import { EntityManager } from 'typeorm';
import { ATTEMPT_STATUS } from '../../common/constants/statuses';
import { paginated } from '../../common/utils/pagination';
import { round2 } from '../../common/utils/money';
import { AuthUser } from '../../common/middlewares/auth.middleware';
import { ExamAttempt } from '../attempts/entities/exam-attempt.entity';
import { attemptsRepository } from '../attempts/attempts.repository';
import { examsService } from '../exams/exams.service';
import { resultsRepository } from './results.repository';

interface FinalizeContext {
  studentId: string;
  examId: string;
  autoSubmitted: boolean;
}

/** Scores a locked, in-progress attempt, stores its result and refreshes the exam leaderboard. */
const finalizeAttempt = async (attempt: ExamAttempt, ctx: FinalizeContext, manager: EntityManager) => {
  const [questions, links] = await Promise.all([
    attemptsRepository.findQuestions(attempt.attemptId, manager),
    resultsRepository.findScoringLinks(attempt.levelId, manager),
  ]);

  let earned = 0;
  let lost = 0;
  let unattempted = 0;
  for (const aq of questions) {
    if (!aq.selectedOptionId) {
      unattempted++;
      continue;
    }
    const link = links.find((l) => l.questionId === aq.questionId);
    const weight = link ? link.weightage : 1;
    const marks = link ? link.levelCategory.marksPerQuestion : 1;
    const penalty = link ? link.levelCategory.negativeMarking : 0;
    const correct = aq.question.options.some((o) => o.optionId === aq.selectedOptionId && o.isCorrect);
    if (correct) earned += marks * weight;
    else lost += penalty * weight;
  }

  attempt.status = ATTEMPT_STATUS.SUBMITTED;
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = ctx.autoSubmitted;
  await attemptsRepository.save(attempt, manager);

  const result = await resultsRepository.create(
    {
      attemptId: attempt.attemptId,
      studentId: ctx.studentId,
      examId: ctx.examId,
      levelId: attempt.levelId,
      score: round2(earned - lost),
      marksEarned: round2(earned),
      marksLost: round2(lost),
      unattemptedCount: unattempted,
      averageScore: 0,
      rank: null,
    },
    manager,
  );
  result.averageScore = round2(await resultsRepository.averageForStudent(ctx.studentId, ctx.examId, manager));
  await manager.save(result);

  await resultsRepository.lockExamLeaderboard(ctx.examId, manager);
  await resultsRepository.rebuildLeaderboard(ctx.examId, manager);
  return resultsRepository.findByAttempt(attempt.attemptId, manager);
};

const getLeaderboard = async (examId: string, query: { page: number; size: number }, user: AuthUser) => {
  const exam = await examsService.getVisibleExam(examId, user);
  const [entries, total] = await resultsRepository.listLeaderboard(examId, query.page, query.size);
  const items = entries.map((e) => ({
    rank: e.rank,
    studentId: e.studentId,
    name: [e.student.profile?.firstName, e.student.profile?.lastName].filter(Boolean).join(' ') || 'Student',
    schoolName: e.student.profile?.schoolName ?? null,
    bestScore: e.bestScore,
    averageScore: e.averageScore,
    tieBreakValue: e.tieBreakValue,
    publishedAt: e.publishedAt,
  }));
  const me = await resultsRepository.findLeaderboardEntry(examId, user.userId);
  return { exam: { examId: exam.examId, name: exam.name }, myRank: me?.rank ?? null, ...paginated(items, total, query) };
};

export const resultsService = { finalizeAttempt, getLeaderboard };
