import { RequestHandler } from 'express';
import { userId } from '../../common/auth.middleware';
import { parseQuery } from '../../common/validate';
import * as settings from './payment-settings.service';
import * as payments from './payments.service';
import { ledgerQuery } from './payments.schema';
import { getRegistration } from '../registrations/registrations.service';

export const publicConfig: RequestHandler = async (_req, res) => { res.json(await settings.getPublicConfig()); };

export const verify: RequestHandler = async (req, res) => {
  await payments.verifyRazorpayPayment(userId(req), req.body);
  res.json(await getRegistration(userId(req), req.body.registrationId));
};

export const mockComplete: RequestHandler = async (req, res) => {
  await payments.completeMockPayment(userId(req), req.body.registrationId);
  res.json(await getRegistration(userId(req), req.body.registrationId));
};

export const webhook: RequestHandler = async (req, res) => {
  await payments.handleWebhook(req.body as Buffer, req.header('x-razorpay-signature'));
  res.json({ ok: true });
};

export const getSettings: RequestHandler = async (_req, res) => { res.json(await settings.getSettings()); };
export const updateSettings: RequestHandler = async (req, res) => { res.json(await settings.updateSettings(req.body)); };

export const studentPayments: RequestHandler = async (req, res) => { res.json(await payments.listStudentPayments(userId(req))); };
export const ledger: RequestHandler = async (req, res) => { res.json(await payments.listLedger(parseQuery(ledgerQuery, req.query))); };
