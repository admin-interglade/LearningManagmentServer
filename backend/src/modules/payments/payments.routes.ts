import express, { Router } from 'express';
import { authenticate, requireRole } from '../../common/auth.middleware';
import { validateBody } from '../../common/validate';
import { mockCompleteSchema, paymentSettingsSchema, verifySchema } from './payments.schema';
import * as ctrl from './payments.controller';

/** Webhook needs the raw body for signature verification; mount before express.json(). */
export const paymentsWebhookRouter = Router();
paymentsWebhookRouter.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), ctrl.webhook);

export const paymentsRouter = Router();
paymentsRouter.get('/config', ctrl.publicConfig);
paymentsRouter.post('/verify', authenticate, requireRole('student'), validateBody(verifySchema), ctrl.verify);
paymentsRouter.post('/mock-complete', authenticate, requireRole('student'), validateBody(mockCompleteSchema), ctrl.mockComplete);

export const paymentSettingsAdminRouter = Router();
paymentSettingsAdminRouter.get('/settings/payment', ctrl.getSettings);
paymentSettingsAdminRouter.put('/settings/payment', validateBody(paymentSettingsSchema), ctrl.updateSettings);
paymentSettingsAdminRouter.get('/payments', ctrl.ledger);

/** Student: mounted under /api/student. */
export const paymentsStudentRouter = Router();
paymentsStudentRouter.get('/payments', ctrl.studentPayments);
