export const EXAM_STATUS = ['draft', 'registration_open', 'ongoing', 'completed', 'cancelled'] as const;
export type ExamStatus = (typeof EXAM_STATUS)[number];

export const COMPLEXITY = ['low', 'medium', 'high'] as const;
export type Complexity = (typeof COMPLEXITY)[number];

export const DISCOUNT_TYPE = ['percentage', 'flat'] as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[number];

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
} as const;

export const REGISTRATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_TXN_STATUS = {
  CREATED: 'created',
  CAPTURED: 'captured',
  FAILED: 'failed',
} as const;

export const ATTEMPT_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
} as const;

export const NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const CHANNEL = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as const;
export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];
