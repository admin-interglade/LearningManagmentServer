import { repo } from '../../common/utils/db';
import { Registration } from '../registrations/entities/registration.entity';
import { ExamAttempt } from '../attempts/entities/exam-attempt.entity';
import { Payment } from '../payments/entities/payment.entity';

const countBy = <T extends { count: number }>(rows: T[], key: keyof T) =>
  Object.fromEntries(rows.map((r) => [r[key] as string, r.count]));

export const adminRepository = {
  registrationsByStatus: async (examId?: string) => {
    const qb = repo(Registration)
      .createQueryBuilder('r')
      .select('r.registrationStatus', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('r.registrationStatus');
    if (examId) qb.where('r.examId = :examId', { examId });
    return countBy(await qb.getRawMany<{ status: string; count: number }>(), 'status');
  },

  attemptsByStatus: async (examId?: string) => {
    const qb = repo(ExamAttempt)
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('a.status');
    if (examId) qb.innerJoin('a.level', 'level').where('level.examId = :examId', { examId });
    return countBy(await qb.getRawMany<{ status: string; count: number }>(), 'status');
  },

  attemptsByLevel: (examId: string) =>
    repo(ExamAttempt)
      .createQueryBuilder('a')
      .innerJoin('a.level', 'level')
      .select('level.levelId', 'level_id')
      .addSelect('COUNT(*)::int', 'attempts')
      .addSelect(`COUNT(*) FILTER (WHERE a.status = 'submitted')::int`, 'submitted')
      .addSelect('COUNT(*) FILTER (WHERE a.autoSubmitted)::int', 'auto_submitted')
      .where('level.examId = :examId', { examId })
      .groupBy('level.levelId')
      .getRawMany<{ level_id: string; attempts: number; submitted: number; auto_submitted: number }>(),

  discountUsage: (examId: string) =>
    repo(Registration)
      .createQueryBuilder('r')
      .innerJoin('r.discount', 'd')
      .select('d.code', 'code')
      .addSelect('COUNT(*)::int', 'registrations')
      .addSelect('COALESCE(SUM(r.discountAmount), 0)::float', 'total_discount')
      .where('r.examId = :examId', { examId })
      .groupBy('d.code')
      .getRawMany(),

  recentRegistrations: (limit: number) =>
    repo(Registration)
      .createQueryBuilder('r')
      .innerJoin('r.exam', 'exam')
      .innerJoin('r.student', 'student')
      .leftJoin('student.profile', 'profile')
      .addSelect(['exam.examId', 'exam.name', 'student.userId', 'student.email', 'student.mobile', 'profile.firstName', 'profile.lastName'])
      .orderBy('r.createdAt', 'DESC')
      .limit(limit)
      .getMany(),

  revenueByDay: (days: number) =>
    repo(Payment)
      .createQueryBuilder('p')
      .select(`to_char(date_trunc('day', p.verifiedAt), 'YYYY-MM-DD')`, 'day')
      .addSelect('SUM(p.amount)::float', 'amount')
      .addSelect('COUNT(*)::int', 'payments')
      .where(`p.status = 'captured'`)
      .andWhere(`p.verifiedAt >= now() - make_interval(days => :days)`, { days })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany(),
};
