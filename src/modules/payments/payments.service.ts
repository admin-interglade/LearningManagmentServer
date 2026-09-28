import { AppError } from '../../common/errors/app-error';
import { PAYMENT_STATUS, PAYMENT_TXN_STATUS, REGISTRATION_STATUS } from '../../common/constants/statuses';
import { transaction } from '../../common/utils/db';
import { toMinorUnits } from '../../common/utils/money';
import { registrationsRepository } from '../registrations/registrations.repository';
import { discountsRepository } from '../discounts/discounts.repository';
import { notificationsService } from '../notifications/notifications.service';
import { paymentsRepository } from './payments.repository';
import { razorpayClient } from './razorpay.client';
import { CreateOrderBody, VerifyPaymentBody } from './payments.validation';

const loadOwnRegistration = async (registrationId: string, studentId: string) => {
  const registration = await registrationsRepository.findById(registrationId);
  if (!registration || registration.studentId !== studentId) throw AppError.notFound('Registration not found');
  return registration;
};

const createOrder = async (studentId: string, body: CreateOrderBody) => {
  const registration = await loadOwnRegistration(body.registration_id, studentId);
  if (registration.paymentStatus === PAYMENT_STATUS.PAID) throw AppError.conflict('Registration is already paid');
  if (registration.registrationStatus === REGISTRATION_STATUS.CANCELLED) throw AppError.badRequest('Registration is cancelled');

  // The server is the source of truth for the price; the client echo just guards against stale UIs
  if (toMinorUnits(body.amount) !== toMinorUnits(registration.netAmount)) {
    throw AppError.badRequest(`Amount mismatch: payable amount is ${registration.netAmount}`);
  }
  if (body.currency !== registration.exam.currency) {
    throw AppError.badRequest(`Currency mismatch: exam is priced in ${registration.exam.currency}`);
  }

  const order = await razorpayClient.createOrder(
    toMinorUnits(registration.netAmount),
    registration.exam.currency,
    registration.registrationId.replace(/-/g, '').slice(0, 40),
  );

  const payment = await paymentsRepository.create({
    registrationId: registration.registrationId,
    provider: 'razorpay',
    orderId: order.id,
    amount: registration.netAmount,
    currency: registration.exam.currency,
    status: PAYMENT_TXN_STATUS.CREATED,
  });

  return {
    paymentId: payment.paymentId,
    razorpayOrderId: order.id,
    razorpayKeyId: razorpayClient.keyId,
    amount: registration.netAmount,
    amountMinor: order.amount,
    currency: order.currency,
    registrationId: registration.registrationId,
  };
};

const verify = async (studentId: string, body: VerifyPaymentBody) => {
  const registration = await loadOwnRegistration(body.registration_id, studentId);

  const result = await transaction(async (manager) => {
    const payment = await paymentsRepository.findByOrderForUpdate(body.razorpay_order_id, registration.registrationId, manager);
    if (!payment) throw AppError.notFound('Payment order not found for this registration');

    // Idempotent: a repeated verify for an already-captured payment just reports success
    if (payment.status === PAYMENT_TXN_STATUS.CAPTURED) return { payment, alreadyVerified: true };

    if (!razorpayClient.verifySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      payment.status = PAYMENT_TXN_STATUS.FAILED;
      payment.paymentIdExternal = body.razorpay_payment_id;
      await paymentsRepository.save(payment, manager);
      return { payment, invalid: true };
    }

    payment.status = PAYMENT_TXN_STATUS.CAPTURED;
    payment.paymentIdExternal = body.razorpay_payment_id;
    payment.signature = body.razorpay_signature;
    payment.verifiedAt = new Date();
    await paymentsRepository.save(payment, manager);

    const locked = await registrationsRepository.findByIdForUpdate(registration.registrationId, manager);
    if (locked && locked.paymentStatus !== PAYMENT_STATUS.PAID) {
      locked.paymentStatus = PAYMENT_STATUS.PAID;
      locked.registrationStatus = REGISTRATION_STATUS.CONFIRMED;
      await registrationsRepository.save(locked, manager);
      if (locked.discountId) await discountsRepository.incrementUsage(locked.discountId, manager);
    }
    return { payment };
  });

  // Committed outside the throw so a failed signature is still recorded against the order
  if (result.invalid) throw AppError.badRequest('Payment signature verification failed');

  if (!result.alreadyVerified) {
    notificationsService.notifySafely({
      userId: studentId,
      eventType: 'PAYMENT_SUCCESS',
      payload: { exam_name: registration.exam.name, amount: result.payment.amount, currency: result.payment.currency },
    });
    notificationsService.notifySafely({
      userId: studentId,
      eventType: 'REGISTRATION_CONFIRMED',
      payload: { exam_name: registration.exam.name, registration_id: registration.registrationId },
    });
  }

  const { signature: _sig, ...payment } = result.payment;
  return {
    payment,
    registrationId: registration.registrationId,
    paymentStatus: PAYMENT_STATUS.PAID,
    registrationStatus: REGISTRATION_STATUS.CONFIRMED,
  };
};

export const paymentsService = { createOrder, verify };
