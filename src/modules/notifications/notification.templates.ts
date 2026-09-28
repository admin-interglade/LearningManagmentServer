export const NOTIFICATION_EVENTS = [
  'REGISTRATION_CONFIRMED',
  'PAYMENT_SUCCESS',
  'PASSWORD_RESET',
  'RESULT_PUBLISHED',
  'EXAM_REMINDER',
  'CUSTOM',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

interface Template {
  code: string;
  subject: (p: Record<string, unknown>) => string;
  body: (p: Record<string, unknown>) => string;
}

const s = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value));

export const TEMPLATES: Record<NotificationEvent, Template> = {
  REGISTRATION_CONFIRMED: {
    code: 'REG_CONFIRMED_V1',
    subject: (p) => `Registration confirmed: ${s(p.exam_name, 'your exam')}`,
    body: (p) => `Your registration for ${s(p.exam_name, 'the exam')} is confirmed. Registration ID: ${s(p.registration_id)}.`,
  },
  PAYMENT_SUCCESS: {
    code: 'PAYMENT_SUCCESS_V1',
    subject: () => 'Payment received',
    body: (p) => `We received your payment of ${s(p.currency)} ${s(p.amount)} for ${s(p.exam_name, 'the exam')}.`,
  },
  PASSWORD_RESET: {
    code: 'PASSWORD_RESET_V1',
    subject: () => 'Reset your password',
    body: (p) => `Use this link to reset your password: ${s(p.reset_link)}. It expires soon. Ignore this if you did not request it.`,
  },
  RESULT_PUBLISHED: {
    code: 'RESULT_PUBLISHED_V1',
    subject: (p) => `Your result for ${s(p.exam_name, 'the exam')}`,
    body: (p) => `Your ${s(p.level_name, 'level')} result is ready. Score: ${s(p.score)}.`,
  },
  EXAM_REMINDER: {
    code: 'EXAM_REMINDER_V1',
    subject: (p) => `Reminder: ${s(p.exam_name, 'your exam')}`,
    body: (p) => `${s(p.exam_name, 'Your exam')} starts at ${s(p.exam_start)}.`,
  },
  CUSTOM: {
    code: 'CUSTOM_V1',
    subject: (p) => s(p.subject, 'Notification'),
    body: (p) => s(p.message),
  },
};
