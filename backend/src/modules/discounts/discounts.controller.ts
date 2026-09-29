import { RequestHandler } from 'express';
import * as svc from './discounts.service';

const id = (req: Parameters<RequestHandler>[0]) => String(req.params.id);

export const list: RequestHandler = async (_req, res) => { res.json(await svc.listDiscounts()); };
export const create: RequestHandler = async (req, res) => { res.status(201).json(await svc.createDiscount(req.body)); };
export const update: RequestHandler = async (req, res) => { res.json(await svc.updateDiscount(id(req), req.body)); };
export const remove: RequestHandler = async (req, res) => { res.json(await svc.deleteDiscount(id(req))); };

/** Student: full price breakdown with a code, so the order summary matches the charge. */
export const validate: RequestHandler = async (req, res) => {
  const { code, label, gross, discount, taxable, tax, total } = await svc.priceFor(req.body.examId, req.body.code);
  res.json({ code, label, gross, discount, taxable, tax, total });
};
