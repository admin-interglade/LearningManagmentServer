import { RequestHandler } from 'express';
import { userId } from '../../common/auth.middleware';
import * as svc from './attempts.service';

const id = (req: Parameters<RequestHandler>[0]) => String(req.params.id);

export const start: RequestHandler = async (req, res) => { res.status(201).json(await svc.startAttempt(userId(req), req.body)); };
export const get: RequestHandler = async (req, res) => { res.json(await svc.getAttempt(userId(req), id(req))); };
export const answer: RequestHandler = async (req, res) => {
  res.json(await svc.saveAnswer(userId(req), id(req), req.body.position, req.body.selectedIndex));
};
export const submit: RequestHandler = async (req, res) => { res.json(await svc.submitAttempt(userId(req), id(req))); };
