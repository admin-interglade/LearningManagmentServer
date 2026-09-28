import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { PAYMENT_TXN_STATUS } from '../../common/constants/statuses';
import { Payment } from './entities/payment.entity';

export const paymentsRepository = {
  create: (data: Partial<Payment>) => repo(Payment).save(repo(Payment).create(data)),

  findByOrderForUpdate: (orderId: string, registrationId: string, manager: EntityManager) =>
    repo(Payment, manager).findOne({ where: { orderId, registrationId }, lock: { mode: 'pessimistic_write' } }),

  save: (payment: Payment, manager?: EntityManager) => repo(Payment, manager).save(payment),

  sumCaptured: async (examId?: string) => {
    const qb = repo(Payment)
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.status = :status', { status: PAYMENT_TXN_STATUS.CAPTURED });
    if (examId) qb.innerJoin('p.registration', 'r').andWhere('r.examId = :examId', { examId });
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  },
};
