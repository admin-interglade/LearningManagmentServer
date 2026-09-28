import crypto from 'crypto';
import { env } from '../../config/env';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

const { keyId, keySecret, mock } = env.razorpay;

const createOrder = async (amountMinor: number, currency: string, receipt: string): Promise<RazorpayOrder> => {
  if (mock) {
    return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, amount: amountMinor, currency, receipt, status: 'created' };
  }
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountMinor, currency, receipt }),
  });
  const data = (await response.json()) as RazorpayOrder & { error?: { description?: string } };
  if (!response.ok) throw new Error(`Razorpay order failed: ${data.error?.description ?? response.status}`);
  return data;
};

// https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#verify-payment-signature
const verifySignature = (orderId: string, paymentId: string, signature: string): boolean => {
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET is not configured');
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const razorpayClient = { keyId, createOrder, verifySignature };
