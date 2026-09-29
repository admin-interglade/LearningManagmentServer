import { queryOne } from '../../db/pool';
import { badRequest } from '../../common/errors';
import { PaymentSettingsInput } from './payments.schema';

export interface PaymentSettingsRow {
  key_id: string | null; key_secret: string | null; webhook_secret: string | null; currency: string;
  business_name: string; merchant_email: string | null; gst_percent: number; mode: 'test' | 'live';
  enabled: boolean; updated_at: Date;
}

export const loadSettings = async () => (await queryOne<PaymentSettingsRow>('SELECT * FROM payment_settings WHERE id = 1'))!;

/** Razorpay is used once both keys are saved; until then payments run in mock mode. */
export const effectiveProvider = (s: PaymentSettingsRow): 'razorpay' | 'mock' => (s.key_id && s.key_secret ? 'razorpay' : 'mock');

/** Admin view. Secrets are never returned, only whether they are set. */
const toAdmin = (s: PaymentSettingsRow) => ({
  provider: 'Razorpay', keyId: s.key_id, hasKeySecret: !!s.key_secret, hasWebhookSecret: !!s.webhook_secret,
  currency: s.currency, merchantName: s.business_name, merchantEmail: s.merchant_email, gstPercent: s.gst_percent,
  testMode: s.mode === 'test', enabled: s.enabled, updatedAt: s.updated_at,
});

export async function getSettings() {
  return toAdmin(await loadSettings());
}

export async function updateSettings(input: PaymentSettingsInput) {
  const current = await loadSettings();
  if (input.keyId) {
    const expected = input.testMode ? 'rzp_test_' : 'rzp_live_';
    if (!input.keyId.startsWith(expected)) {
      throw badRequest('Validation failed', { keyId: [`Key ID for ${input.testMode ? 'test' : 'live'} mode should start with "${expected}"`] });
    }
  }
  const row = await queryOne<PaymentSettingsRow>(
    `UPDATE payment_settings SET provider='razorpay', key_id=$1, key_secret=$2, webhook_secret=$3, currency=$4,
       business_name=$5, merchant_email=$6, gst_percent=$7, mode=$8, enabled=$9, updated_at=now()
     WHERE id = 1 RETURNING *`,
    [input.keyId, input.keySecret ?? current.key_secret, input.webhookSecret ?? current.webhook_secret, input.currency,
      input.merchantName, input.merchantEmail, input.gstPercent, input.testMode ? 'test' : 'live', input.enabled],
  );
  return toAdmin(row!);
}

export async function getPublicConfig() {
  const s = await loadSettings();
  const provider = effectiveProvider(s);
  return {
    provider, keyId: provider === 'razorpay' ? s.key_id : null, currency: s.currency, merchantName: s.business_name,
    gstPercent: s.gst_percent, enabled: s.enabled,
  };
}
