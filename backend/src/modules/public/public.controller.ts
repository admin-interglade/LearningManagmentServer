import { RequestHandler } from 'express';
import * as svc from './public.service';

export const listExams: RequestHandler = async (_req, res) => { res.json(await svc.listPublishedExams()); };
export const getExam: RequestHandler = async (req, res) => { res.json(await svc.getPublicExam(String(req.params.id))); };
export const stats: RequestHandler = async (_req, res) => { res.json(await svc.getStats()); };
