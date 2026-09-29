import crypto from 'crypto';
import { AppError } from '../../common/errors';

const API = 'https://api.razorpay.com/v1';

export async function createRazorpayOrder(keyId: string, keySecret: string, amountPaise: number, currency: string, receipt: string) {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({ amount: amountPaise, currency, receipt }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
  if (!res.ok || !body.id) {
    throw new AppError(502, `Payment gateway error: ${body.error?.description ?? res.statusText}`, 'PAYMENT_GATEWAY');
  }
  return body.id;
}

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string) {
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
