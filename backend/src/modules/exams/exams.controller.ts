import { RequestHandler } from 'express';
import { parseQuery } from '../../common/validate';
import { examListQuery } from './exams.schema';
import * as svc from './exams.service';
import { getLeaderboard } from '../leaderboard/leaderboard.service';
import { examReport } from '../dashboard/dashboard.service';
import { findExamById } from './exams.repository';

const p = (req: Parameters<RequestHandler>[0], name: string) => String(req.params[name]);

export const list: RequestHandler = async (req, res) => {
  res.json(await svc.listExams(parseQuery(examListQuery, req.query).status));
};
export const get: RequestHandler = async (req, res) => { res.json(await svc.getExam(p(req, 'id'))); };
export const create: RequestHandler = async (req, res) => { res.status(201).json(await svc.createExam(req.body)); };
export const update: RequestHandler = async (req, res) => { res.json(await svc.updateExam(p(req, 'id'), req.body)); };
export const remove: RequestHandler = async (req, res) => { res.json(await svc.deleteExam(p(req, 'id'))); };
export const publish: RequestHandler = async (req, res) => { res.json(await svc.setPublished(p(req, 'id'), req.body.isPublished)); };
export const registrations: RequestHandler = async (req, res) => { res.json(await svc.listRegistrations(p(req, 'id'))); };
export const leaderboard: RequestHandler = async (req, res) => {
  const exam = await findExamById(p(req, 'id'));
  res.json({ exam: { id: exam.id, title: exam.title, phase: exam.phase }, entries: await getLeaderboard(exam), me: null });
};
export const report: RequestHandler = async (req, res) => { res.json(await examReport(await findExamById(p(req, 'id')))); };
export const createSlot: RequestHandler = async (req, res) => { res.status(201).json(await svc.createSlot(p(req, 'examId'), req.body)); };
export const updateSlot: RequestHandler = async (req, res) => { res.json(await svc.updateSlot(p(req, 'slotId'), req.body)); };
export const deleteSlot: RequestHandler = async (req, res) => { res.json(await svc.deleteSlot(p(req, 'slotId'))); };
