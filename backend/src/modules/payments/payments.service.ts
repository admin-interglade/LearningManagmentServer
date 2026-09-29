import crypto from 'crypto';
import { PoolClient } from 'pg';
import { Queryable, pool, query, queryOne, withTransaction } from '../../db/pool';
import { badRequest, forbidden, notFound } from '../../common/errors';
import { effectiveProvider, loadSettings } from './payment-settings.service';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from './razorpay.client';
import type { Price } from '../discounts/discounts.service';

export interface OrderInfo { orderId: string; amount: number; currency: string; keyId: string | null; provider: 'razorpay' | 'mock' }

export interface PaymentRow {
  id: string; registration_id: string; provider: 'razorpay' | 'mock' | 'free'; provider_order_id: string | null;
  provider_payment_id: string | null; amount: number; gross: number; discount_amount: number; tax_amount: number;
  discount_code: string | null; method: string | null; status: 'pending' | 'paid' | 'failed' | 'refunded'; created_at: Date;
}

export const toPayment = (p: PaymentRow) => ({
  id: p.id, gross: p.gross, discount: p.discount_amount, tax: p.tax_amount, amount: p.amount, discountCode: p.discount_code,
  status: p.status, method: p.method,
  razorpayOrderId: p.provider === 'razorpay' ? p.provider_order_id : null,
  razorpayPaymentId: p.provider === 'razorpay' ? p.provider_payment_id : null,
  provider: p.provider, createdAt: new Date(p.created_at), // rows may come through to_jsonb()
});
export type Payment = ReturnType<typeof toPayment>;

const insertPayment = (db: Queryable, registrationId: string, provider: PaymentRow['provider'], orderId: string | null, price: Price, currency: string, paid: boolean) =>
  db.query(
    `INSERT INTO payments (registration_id, provider, provider_order_id, amount, gross, discount_amount, tax_amount, discount_code,
       currency, status, method, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [registrationId, provider, orderId, price.total, price.gross, price.discount, price.tax, price.code, currency,
      paid ? 'paid' : 'pending', paid ? 'Free' : null, paid ? new Date() : null],
  );

/** Records a zero-amount payment for a free registration (caller confirms the registration). */
export async function recordFreePayment(db: PoolClient, registrationId: string, price: Price) {
  await insertPayment(db, registrationId, 'free', null, price, (await loadSettings()).currency, true);
}

/**
 * Creates a gateway order for a pending registration (amount in paise, per Razorpay).
 * Earlier unpaid orders for the registration are marked failed; a late webhook for one of them still confirms it.
 */
export async function createOrder(registrationId: string, price: Price): Promise<OrderInfo> {
  const s = await loadSettings();
  const provider = effectiveProvider(s);
  const amountPaise = Math.round(price.total * 100);
  const receipt = `reg_${registrationId.slice(0, 30)}`;
  const orderId = provider === 'razorpay'
    ? await createRazorpayOrder(s.key_id!, s.key_secret!, amountPaise, s.currency, receipt)
    : `mock_order_${crypto.randomBytes(8).toString('hex')}`;

  await withTransaction(async (db) => {
    await db.query(`UPDATE payments SET status = 'failed' WHERE registration_id = $1 AND status = 'pending'`, [registrationId]);
    await insertPayment(db, registrationId, provider, orderId, price, s.currency, false);
  });
  return { orderId, amount: amountPaise, currency: s.currency, keyId: provider === 'razorpay' ? s.key_id : null, provider };
}

/** Confirms a registration. Idempotent: a second call for an already-confirmed registration is a no-op. */
export async function confirmRegistration(db: PoolClient, registrationId: string) {
  const reg = await queryOne<{ status: string; discount_id: string | null }>(
    'SELECT status, discount_id FROM registrations WHERE id = $1 FOR UPDATE', [registrationId], db,
  );
  if (!reg) throw notFound('Registration not found');
  if (reg.status === 'confirmed') return;
  await db.query(`UPDATE registrations SET status = 'confirmed', paid_at = now() WHERE id = $1`, [registrationId]);
  // Usage is counted when a payment is confirmed, not when a code is validated.
  if (reg.discount_id) await db.query('UPDATE discounts SET used_count = used_count + 1 WHERE id = $1', [reg.discount_id]);
}

async function markOrderPaid(orderId: string, paymentId: string | null, signature: string | null, method: string | null) {
  await withTransaction(async (db) => {
    const payment = await queryOne<{ id: string; registration_id: string; status: string }>(
      'SELECT id, registration_id, status FROM payments WHERE provider_order_id = $1 FOR UPDATE', [orderId], db,
    );
    if (!payment) throw notFound('Payment order not found');
    if (payment.status === 'paid') {
      if (method) await db.query('UPDATE payments SET method = COALESCE(method, $2) WHERE id = $1', [payment.id, method]);
      return;
    }
    await db.query(
      `UPDATE payments SET status = 'paid', provider_payment_id = $2, provider_signature = $3, method = $4, paid_at = now() WHERE id = $1`,
      [payment.id, paymentId, signature, method],
    );
    await confirmRegistration(db, payment.registration_id);
  });
}

async function assertOwnOrder(userId: string, registrationId: string, orderId: string) {
  const row = await queryOne<{ user_id: string }>(
    `SELECT r.user_id FROM payments p JOIN registrations r ON r.id = p.registration_id
     WHERE p.provider_order_id = $1 AND r.id = $2`, [orderId, registrationId],
  );
  if (!row) throw notFound('Payment order not found for this registration');
  if (row.user_id !== userId) throw forbidden();
}

const RAZORPAY_METHODS: Record<string, string> = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI' };

export async function verifyRazorpayPayment(userId: string, input: { registrationId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  await assertOwnOrder(userId, input.registrationId, input.razorpayOrderId);
  const s = await loadSettings();
  if (!s.key_secret || !verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, s.key_secret)) {
    await query(`UPDATE payments SET status = 'failed' WHERE provider_order_id = $1 AND status = 'pending'`, [input.razorpayOrderId]);
    throw badRequest('Payment verification failed. If money was deducted it will be reconciled automatically.');
  }
  await markOrderPaid(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, null);
}

export async function completeMockPayment(userId: string, registrationId: string) {
  const s = await loadSettings();
  if (effectiveProvider(s) !== 'mock') throw badRequest('Mock payments are disabled when Razorpay is configured');
  const order = await queryOne<{ provider_order_id: string }>(
    `SELECT p.provider_order_id FROM payments p JOIN registrations r ON r.id = p.registration_id
     WHERE r.id = $1 AND r.user_id = $2 AND p.provider = 'mock' ORDER BY p.created_at DESC LIMIT 1`,
    [registrationId, userId],
  );
  if (!order) throw notFound('No pending test payment found for this registration');
  await markOrderPaid(order.provider_order_id, `mock_pay_${crypto.randomBytes(6).toString('hex')}`, null, 'Mock');
}

/** Razorpay webhook: handles payment.captured and order.paid. May arrive before /payments/verify. */
export async function handleWebhook(rawBody: Buffer, signature: string | undefined) {
  const s = await loadSettings();
  if (!s.webhook_secret || !signature || !verifyWebhookSignature(rawBody, signature, s.webhook_secret)) {
    throw badRequest('Invalid webhook signature');
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id) {
      const known = await queryOne('SELECT id FROM payments WHERE provider_order_id = $1', [payment.order_id]);
      const method = payment.method ? RAZORPAY_METHODS[payment.method] ?? String(payment.method) : null;
      if (known) await markOrderPaid(payment.order_id, payment.id ?? null, null, method);
    }
  }
}

/** Student receipts page: every payment with its exam. */
export async function listStudentPayments(userId: string, db: Queryable = pool) {
  const rows = await query<PaymentRow & { exam_id: string; exam_title: string }>(
    `SELECT p.*, e.id AS exam_id, e.title AS exam_title FROM payments p
     JOIN registrations r ON r.id = p.registration_id JOIN exams e ON e.id = r.exam_id
     WHERE r.user_id = $1 ORDER BY p.created_at DESC`, [userId], db,
  );
  return rows.map((r) => ({ ...toPayment(r), registrationId: r.registration_id, examId: r.exam_id, examTitle: r.exam_title }));
}

/** Admin ledger: one row per transaction; `totals` cover the filtered paid transactions, not just the page. */
export async function listLedger(f: { examId?: string; search?: string; page: number; pageSize: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.examId) { params.push(f.examId); where.push(`r.exam_id = $${params.length}`); }
  if (f.search) {
    params.push(`%${f.search}%`);
    const n = params.length;
    where.push(`(u.full_name ILIKE $${n} OR u.email ILIKE $${n} OR p.provider_payment_id ILIKE $${n} OR p.provider_order_id ILIKE $${n} OR p.id::text ILIKE $${n})`);
  }
  const from = `FROM payments p JOIN registrations r ON r.id = p.registration_id JOIN users u ON u.id = r.user_id
    JOIN exams e ON e.id = r.exam_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const agg = await queryOne<{ total: number; net: number; discount: number; tax: number }>(
    `SELECT count(*) AS total,
       coalesce(sum(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS net,
       coalesce(sum(p.discount_amount) FILTER (WHERE p.status = 'paid'), 0) AS discount,
       coalesce(sum(p.tax_amount) FILTER (WHERE p.status = 'paid'), 0) AS tax
     ${from}`, params,
  );
  const rows = await query<PaymentRow & { exam_id: string; exam_title: string; user_id: string; full_name: string; email: string | null }>(
    `SELECT p.*, e.id AS exam_id, e.title AS exam_title, u.id AS user_id, u.full_name, u.email ${from}
     ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize],
  );
  return {
    items: rows.map((r) => ({
      ...toPayment(r), examId: r.exam_id, examTitle: r.exam_title,
      student: { id: r.user_id, name: r.full_name, email: r.email },
    })),
    total: agg!.total, page: f.page, pageSize: f.pageSize,
    totals: { net: agg!.net, discount: agg!.discount, tax: agg!.tax },
  };
}
