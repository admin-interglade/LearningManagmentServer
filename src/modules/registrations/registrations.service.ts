import { AppError } from '../../common/errors/app-error';
import { PAYMENT_STATUS, REGISTRATION_STATUS } from '../../common/constants/statuses';
import { isUniqueViolation, transaction } from '../../common/utils/db';
import { round2 } from '../../common/utils/money';
import { examsRepository } from '../exams/exams.repository';
import { discountsRepository } from '../discounts/discounts.repository';
import { discountsService } from '../discounts/discounts.service';
import { notificationsService } from '../notifications/notifications.service';
import { registrationsRepository } from './registrations.repository';
import { CreateRegistrationBody } from './registrations.validation';

const OPEN_STATUSES = ['registration_open', 'ongoing'];

const create = async (studentId: string, body: CreateRegistrationBody) => {
  try {
    const registration = await transaction(async (manager) => {
      const exam = await examsRepository.findById(body.exam_id, manager);
      if (!exam || !exam.isPublished) throw AppError.notFound('Exam not found');
      const now = new Date();
      if (!OPEN_STATUSES.includes(exam.status) || now < exam.registrationStart || now > exam.registrationEnd) {
        throw AppError.badRequest('Registration is not open for this exam');
      }

      const existing = await registrationsRepository.findByStudentAndExam(studentId, exam.examId, manager);
      if (existing) {
        throw new AppError(409, 'You are already registered for this exam', { registration_id: existing.registrationId });
      }

      const gross = exam.fee;
      let discountId: string | null = null;
      let discountAmount = 0;
      if (body.discount_code) {
        const resolved = await discountsService.resolveForExam(body.discount_code, exam.examId, gross, manager);
        discountId = resolved.discount.discountId;
        discountAmount = resolved.amount;
      }
      const net = round2(gross - discountAmount);
      const isFree = net <= 0;

      // Free registrations are confirmed immediately; paid ones consume the discount on payment verification
      if (isFree && discountId) await discountsRepository.incrementUsage(discountId, manager);

      const saved = await registrationsRepository.create(
        {
          studentId,
          examId: exam.examId,
          discountId,
          grossAmount: gross,
          discountAmount,
          netAmount: Math.max(net, 0),
          paymentStatus: isFree ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
          registrationStatus: isFree ? REGISTRATION_STATUS.CONFIRMED : REGISTRATION_STATUS.PENDING,
        },
        manager,
      );
      return { ...saved, exam };
    });

    if (registration.registrationStatus === REGISTRATION_STATUS.CONFIRMED) {
      notificationsService.notifySafely({
        userId: studentId,
        eventType: 'REGISTRATION_CONFIRMED',
        payload: { exam_name: registration.exam.name, registration_id: registration.registrationId },
      });
    }
    const { exam, ...rest } = registration;
    return { ...rest, exam: { examId: exam.examId, name: exam.name, currency: exam.currency }, paymentRequired: rest.netAmount > 0 };
  } catch (err) {
    if (isUniqueViolation(err)) throw AppError.conflict('You are already registered for this exam');
    throw err;
  }
};

export const registrationsService = { create };
