import { AppError } from '../../common/errors/app-error';
import { round2 } from '../../common/utils/money';
import { EntityManager } from 'typeorm';
import { examsRepository } from '../exams/exams.repository';
import { DiscountCode } from './entities/discount-code.entity';
import { discountsRepository } from './discounts.repository';
import { CreateDiscountBody, discountRuleErrors, UpdateDiscountBody } from './discounts.validation';

const assertExam = async (examId: string | null | undefined) => {
  if (examId && !(await examsRepository.findById(examId))) throw AppError.badRequest('exam_id does not exist');
};

const create = async (body: CreateDiscountBody) => {
  await assertExam(body.exam_id);
  if (await discountsRepository.findByCode(body.code)) throw AppError.conflict('Discount code already exists');
  return discountsRepository.create({
    code: body.code,
    discountType: body.discount_type,
    discountValue: body.discount_value,
    validFrom: body.valid_from,
    validTo: body.valid_to,
    usageLimit: body.usage_limit,
    usedCount: 0,
    maxDiscount: body.max_discount ?? null,
    examId: body.exam_id ?? null,
    isActive: body.is_active,
  });
};

const update = async (discountId: string, body: UpdateDiscountBody) => {
  const discount = await discountsRepository.findById(discountId);
  if (!discount) throw AppError.notFound('Discount not found');

  const errors = discountRuleErrors({
    discount_type: body.discount_type ?? discount.discountType,
    discount_value: body.discount_value ?? discount.discountValue,
    valid_from: body.valid_from ?? discount.validFrom,
    valid_to: body.valid_to ?? discount.validTo,
  });
  if (body.usage_limit !== undefined && body.usage_limit < discount.usedCount) {
    errors.push(`usage_limit cannot be below used_count (${discount.usedCount})`);
  }
  if (errors.length) throw AppError.badRequest('Invalid discount', errors);

  if (body.code && body.code !== discount.code) {
    if (await discountsRepository.findByCode(body.code)) throw AppError.conflict('Discount code already exists');
    discount.code = body.code;
  }
  if (body.exam_id !== undefined) {
    await assertExam(body.exam_id);
    discount.examId = body.exam_id ?? null;
  }
  if (body.discount_type) discount.discountType = body.discount_type;
  if (body.discount_value !== undefined) discount.discountValue = body.discount_value;
  if (body.valid_from) discount.validFrom = body.valid_from;
  if (body.valid_to) discount.validTo = body.valid_to;
  if (body.usage_limit !== undefined) discount.usageLimit = body.usage_limit;
  if (body.max_discount !== undefined) discount.maxDiscount = body.max_discount ?? null;
  if (body.is_active !== undefined) discount.isActive = body.is_active;
  return discountsRepository.save(discount);
};

// Validates a code for an exam and returns the amount it takes off `gross`
const resolveForExam = async (code: string, examId: string, gross: number, manager: EntityManager) => {
  const discount = await discountsRepository.findByCodeForUpdate(code.trim().toUpperCase(), manager);
  const now = new Date();
  if (!discount || !discount.isActive) throw AppError.badRequest('Invalid discount code');
  if (now < discount.validFrom || now > discount.validTo) throw AppError.badRequest('Discount code is not valid at this time');
  if (discount.usedCount >= discount.usageLimit) throw AppError.badRequest('Discount code usage limit reached');
  if (discount.examId && discount.examId !== examId) throw AppError.badRequest('Discount code is not valid for this exam');

  return { discount, amount: computeDiscount(discount, gross) };
};

const computeDiscount = (discount: DiscountCode, gross: number) => {
  let amount = discount.discountType === 'percentage' ? (gross * discount.discountValue) / 100 : discount.discountValue;
  if (discount.maxDiscount !== null) amount = Math.min(amount, discount.maxDiscount);
  return round2(Math.min(amount, gross));
};

export const discountsService = { create, update, resolveForExam };
