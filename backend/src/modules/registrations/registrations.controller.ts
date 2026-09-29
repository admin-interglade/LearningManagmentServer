import { RequestHandler } from 'express';
import { userId } from '../../common/auth.middleware';
import * as svc from './registrations.service';

const p = (req: Parameters<RequestHandler>[0], name: string) => String(req.params[name]);

export const create: RequestHandler = async (req, res) => {
  res.status(201).json(await svc.register(userId(req), req.body.examId, req.body.discountCode));
};
export const list: RequestHandler = async (req, res) => { res.json(await svc.listRegistrations(userId(req))); };
export const detail: RequestHandler = async (req, res) => { res.json(await svc.getRegistrationDetail(userId(req), p(req, 'id'))); };
export const selectSlot: RequestHandler = async (req, res) => {
  res.json(await svc.selectSlot(userId(req), p(req, 'id'), req.body.levelId, req.body.slotId));
};
export const dashboard: RequestHandler = async (req, res) => { res.json(await svc.getDashboard(userId(req))); };
export const leaderboard: RequestHandler = async (req, res) => {
  res.json(await svc.getStudentLeaderboard(userId(req), p(req, 'examId')));
};
