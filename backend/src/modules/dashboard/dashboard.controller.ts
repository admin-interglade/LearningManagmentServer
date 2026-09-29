import { RequestHandler } from 'express';
import { z } from 'zod';
import { parseQuery } from '../../common/validate';
import * as svc from './dashboard.service';

const statusQuery = z.object({ status: z.enum(['completed', 'in_progress', 'future']) });

export const summary: RequestHandler = async (_req, res) => { res.json(await svc.getSummary()); };
export const exams: RequestHandler = async (req, res) => {
  res.json(await svc.getExamsByStatus(parseQuery(statusQuery, req.query).status));
};
