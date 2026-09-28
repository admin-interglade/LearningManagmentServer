import { AppError } from '../../common/errors/app-error';
import { ROLES } from '../../common/constants/roles';
import { usersRepository } from '../users/users.repository';
import { examsRepository } from '../exams/exams.repository';
import { paymentsRepository } from '../payments/payments.repository';
import { resultsRepository } from '../results/results.repository';
import { notificationsRepository } from '../notifications/notifications.repository';
import { adminRepository } from './admin.repository';

const dashboard = async () => {
  const [students, examsByStatus, registrations, attempts, revenue, failedDeliveries, recent, revenueTrend] = await Promise.all([
    usersRepository.countByRole(ROLES.STUDENT),
    examsRepository.countByStatus(),
    adminRepository.registrationsByStatus(),
    adminRepository.attemptsByStatus(),
    paymentsRepository.sumCaptured(),
    notificationsRepository.countFailedDeliveries(),
    adminRepository.recentRegistrations(10),
    adminRepository.revenueByDay(30),
  ]);

  return {
    totals: {
      students,
      exams: examsByStatus.reduce((sum, row) => sum + row.count, 0),
      registrations: Object.values(registrations).reduce((a, b) => a + b, 0),
      revenue,
      failedNotificationDeliveries: failedDeliveries,
    },
    examsByStatus: Object.fromEntries(examsByStatus.map((r) => [r.status, r.count])),
    registrationsByStatus: registrations,
    attemptsByStatus: attempts,
    revenueLast30Days: revenueTrend,
    recentRegistrations: recent.map((r) => ({
      registrationId: r.registrationId,
      exam: { examId: r.exam.examId, name: r.exam.name },
      student: {
        userId: r.student.userId,
        name: [r.student.profile?.firstName, r.student.profile?.lastName].filter(Boolean).join(' '),
        email: r.student.email,
        mobile: r.student.mobile,
      },
      netAmount: r.netAmount,
      paymentStatus: r.paymentStatus,
      registrationStatus: r.registrationStatus,
      createdAt: r.createdAt,
    })),
  };
};

const examReport = async (examId: string) => {
  const exam = await examsRepository.findById(examId);
  if (!exam) throw AppError.notFound('Exam not found');

  const [levels, registrations, revenue, attemptsByLevel, levelStats, discounts, top] = await Promise.all([
    examsRepository.findLevelsByExam(examId),
    adminRepository.registrationsByStatus(examId),
    paymentsRepository.sumCaptured(examId),
    adminRepository.attemptsByLevel(examId),
    resultsRepository.levelStats(examId),
    adminRepository.discountUsage(examId),
    resultsRepository.topForExam(examId, 10),
  ]);

  return {
    exam,
    registrations: { ...registrations, total: Object.values(registrations).reduce((a, b) => a + b, 0) },
    revenue: { collected: revenue, currency: exam.currency },
    discounts,
    levels: levels.map((level) => {
      const attempts = attemptsByLevel.find((a) => a.level_id === level.levelId);
      const stats = levelStats.find((s) => s.level_id === level.levelId);
      return {
        levelId: level.levelId,
        levelNumber: level.levelNumber,
        name: level.name,
        maxScore: level.maxScore,
        attempts: attempts?.attempts ?? 0,
        submitted: attempts?.submitted ?? 0,
        autoSubmitted: attempts?.auto_submitted ?? 0,
        averageScore: stats?.average_score ?? null,
        highestScore: stats?.highest_score ?? null,
        lowestScore: stats?.lowest_score ?? null,
        averageUnattempted: stats?.average_unattempted ?? null,
      };
    }),
    topPerformers: top.map((t) => ({
      rank: t.rank,
      studentId: t.studentId,
      name: [t.student.profile?.firstName, t.student.profile?.lastName].filter(Boolean).join(' '),
      email: t.student.email,
      mobile: t.student.mobile,
      bestScore: t.bestScore,
      averageScore: t.averageScore,
    })),
  };
};

export const adminService = { dashboard, examReport };
