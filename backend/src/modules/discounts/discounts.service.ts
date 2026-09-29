import { Queryable, pool, query, queryOne } from '../../db/pool';
import { badRequest, conflict, notFound } from '../../common/errors';
import { round2 } from '../../common/time';
import { loadSettings } from '../payments/payment-settings.service';
import { DiscountInput } from './discounts.schema';

interface DiscountRow {
  id: string; code: string; label: string | null; type: 'percent' | 'flat'; value: number; exam_ids: string[];
  valid_from: Date; valid_to: Date; max_uses: number | null; used_count: number; is_active: boolean; created_at: Date;
}
const toDiscount = (d: DiscountRow) => ({
  id: d.id, code: d.code, label: d.label, type: d.type, value: d.value, validFrom: d.valid_from, validTo: d.valid_to,
  maxUses: d.max_uses, examIds: d.exam_ids, active: d.is_active, used: d.used_count, createdAt: d.created_at,
});

export async function listDiscounts() {
  return (await query<DiscountRow>('SELECT * FROM discounts ORDER BY created_at DESC')).map(toDiscount);
}

async function getDiscount(id: string) {
  const row = await queryOne<DiscountRow>('SELECT * FROM discounts WHERE id = $1', [id]);
  if (!row) throw notFound('Discount not found');
  return toDiscount(row);
}

async function assertExams(examIds: string[]) {
  if (!examIds.length) return;
  const found = await query<{ id: string }>('SELECT id FROM exams WHERE id = ANY($1)', [examIds]);
  if (found.length !== new Set(examIds).size) throw badRequest('Validation failed', { examIds: ['One or more exams do not exist'] });
}

async function assertCodeFree(code: string, exceptId: string | null) {
  const clash = await queryOne('SELECT id FROM discounts WHERE code = $1 AND ($2::uuid IS NULL OR id <> $2)', [code, exceptId]);
  if (clash) throw conflict('A discount with this code already exists', { code: ['This code is already in use'] });
}

const params = (d: DiscountInput) => [d.code, d.label, d.type, d.value, [...new Set(d.examIds)], d.validFrom, d.validTo, d.maxUses, d.active];

export async function createDiscount(d: DiscountInput) {
  await assertExams(d.examIds);
  await assertCodeFree(d.code, null);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO discounts (code, label, type, value, exam_ids, valid_from, valid_to, max_uses, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, params(d));
  return getDiscount(row!.id);
}

export async function updateDiscount(id: string, d: DiscountInput) {
  await assertExams(d.examIds);
  await assertCodeFree(d.code, id);
  const row = await queryOne<{ id: string }>(
    `UPDATE discounts SET code=$2, label=$3, type=$4, value=$5, exam_ids=$6, valid_from=$7, valid_to=$8, max_uses=$9, is_active=$10
     WHERE id=$1 RETURNING id`, [id, ...params(d)]);
  if (!row) throw notFound('Discount not found');
  return getDiscount(id);
}

export async function deleteDiscount(id: string) {
  const row = await queryOne('DELETE FROM discounts WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Discount not found');
  return { ok: true };
}

export interface Price {
  discountId: string | null; code: string | null; label: string | null;
  gross: number; discount: number; taxable: number; tax: number; total: number;
}

const invalidCode = (message: string) => badRequest(message, { code: [message] });

/**
 * Price for an exam with an optional code: GST (from payment settings) is applied to the discounted amount.
 * Throws a 400 with a readable reason (also under `details.code`) when the code cannot be used right now.
 */
export async function priceFor(examId: string, code: string | null | undefined, db: Queryable = pool): Promise<Price> {
  const exam = await queryOne<{ fee: number }>('SELECT fee FROM exams WHERE id = $1', [examId], db);
  if (!exam) throw notFound('Exam not found');
  const gross = exam.fee;
  let discount = 0;
  let d: DiscountRow | null = null;

  if (code) {
    d = await queryOne<DiscountRow>('SELECT * FROM discounts WHERE code = $1', [code.trim().toUpperCase()], db);
    const now = new Date();
    if (!d || !d.is_active) throw invalidCode('Invalid discount code');
    if (d.exam_ids.length && !d.exam_ids.includes(examId)) throw invalidCode('This code is not valid for this exam');
    if (now < d.valid_from) throw invalidCode('This discount code is not active yet');
    if (now > d.valid_to) throw invalidCode('This discount code has expired');
    if (d.max_uses !== null && d.used_count >= d.max_uses) throw invalidCode('This discount code has reached its usage limit');
    discount = round2(Math.min(d.type === 'percent' ? (gross * d.value) / 100 : d.value, gross));
  }

  const { gst_percent: gst } = await loadSettings();
  const taxable = round2(gross - discount);
  const tax = round2((taxable * gst) / 100);
  return { discountId: d?.id ?? null, code: d?.code ?? null, label: d?.label ?? null, gross, discount, taxable, tax, total: round2(taxable + tax) };
}
