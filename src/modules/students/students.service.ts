import { AppError } from '../../common/errors/app-error';
import { usersRepository } from '../users/users.repository';
import { registrationsRepository } from '../registrations/registrations.repository';
import { attemptsRepository } from '../attempts/attempts.repository';
import { resultsRepository } from '../results/results.repository';
import { practiceRepository } from '../practice/practice.repository';
import { studentsRepository } from './students.repository';

const dashboard = async (studentId: string) => {
  const user = await usersRepository.findById(studentId);
  if (!user) throw AppError.notFound('User not found');

  const [registrations, attempts, results, leaderboards, practiceAttempts, openExams] = await Promise.all([
    registrationsRepository.findByStudent(studentId),
    attemptsRepository.findByStudent(studentId),
    resultsRepository.findByStudent(studentId),
    resultsRepository.findLeaderboardByStudent(studentId),
    practiceRepository.findAttemptsByStudent(studentId),
    studentsRepository.findOpenExamsNotRegistered(studentId),
  ]);

  const { role, ...profileUser } = user;
  return {
    user: { ...profileUser, role: role.name },
    stats: {
      registrations: registrations.length,
      confirmedRegistrations: registrations.filter((r) => r.registrationStatus === 'confirmed').length,
      attempts: attempts.length,
      results: results.length,
      bestScore: results.length ? Math.max(...results.map((r) => r.score)) : null,
      practiceAttempts: practiceAttempts.length,
    },
    registrations: registrations.map((r) => ({
      registrationId: r.registrationId,
      exam: { examId: r.exam.examId, name: r.exam.name, examStart: r.exam.examStart, examEnd: r.exam.examEnd, status: r.exam.status },
      netAmount: r.netAmount,
      paymentStatus: r.paymentStatus,
      registrationStatus: r.registrationStatus,
      createdAt: r.createdAt,
    })),
    attempts: attempts.map((a) => ({
      attemptId: a.attemptId,
      exam: { examId: a.level.exam.examId, name: a.level.exam.name },
      level: { levelId: a.levelId, name: a.level.name, levelNumber: a.level.levelNumber },
      attemptNumber: a.attemptNumber,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      autoSubmitted: a.autoSubmitted,
    })),
    results: results.map((r) => ({
      resultId: r.resultId,
      attemptId: r.attemptId,
      exam: { examId: r.examId, name: r.exam.name },
      level: { levelId: r.levelId, name: r.level.name, maxScore: r.level.maxScore },
      score: r.score,
      marksEarned: r.marksEarned,
      marksLost: r.marksLost,
      unattemptedCount: r.unattemptedCount,
      rank: r.rank,
      createdAt: r.createdAt,
    })),
    rankings: leaderboards.map((l) => ({
      exam: { examId: l.examId, name: l.exam.name },
      rank: l.rank,
      bestScore: l.bestScore,
      averageScore: l.averageScore,
    })),
    practiceAttempts: practiceAttempts.map((p) => ({
      practiceAttemptId: p.practiceAttemptId,
      exam: { examId: p.practiceTest.examId, name: p.practiceTest.exam.name },
      status: p.status,
      score: p.score,
      startedAt: p.startedAt,
      submittedAt: p.submittedAt,
    })),
    openExams,
  };
};

export const studentsService = { dashboard };
