import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { DiscountCode } from './entities/discount-code.entity';

export const discountsRepository = {
  findById: (discountId: string, manager?: EntityManager) => repo(DiscountCode, manager).findOne({ where: { discountId } }),

  findByCode: (code: string, manager?: EntityManager) => repo(DiscountCode, manager).findOne({ where: { code } }),

  // Row lock so concurrent registrations can't overshoot usage_limit
  findByCodeForUpdate: (code: string, manager: EntityManager) =>
    repo(DiscountCode, manager).findOne({ where: { code }, lock: { mode: 'pessimistic_write' } }),

  create: (data: Partial<DiscountCode>) => repo(DiscountCode).save(repo(DiscountCode).create(data)),

  save: (discount: DiscountCode) => repo(DiscountCode).save(discount),

  incrementUsage: (discountId: string, manager: EntityManager) =>
    repo(DiscountCode, manager).increment({ discountId }, 'usedCount', 1),
};
