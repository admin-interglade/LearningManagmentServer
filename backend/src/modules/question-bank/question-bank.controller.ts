import { RequestHandler } from 'express';
import { parseQuery } from '../../common/validate';
import { questionListQuery } from './question-bank.schema';
import * as svc from './question-bank.service';

const id = (req: Parameters<RequestHandler>[0]) => String(req.params.id);

export const listCategories: RequestHandler = async (_req, res) => { res.json(await svc.listCategories()); };
export const createCategory: RequestHandler = async (req, res) => { res.status(201).json(await svc.createCategory(req.body)); };
export const updateCategory: RequestHandler = async (req, res) => { res.json(await svc.updateCategory(id(req), req.body)); };

export const listQuestions: RequestHandler = async (req, res) => {
  res.json(await svc.listQuestions(parseQuery(questionListQuery, req.query)));
};
export const createQuestion: RequestHandler = async (req, res) => { res.status(201).json(await svc.createQuestion(req.body)); };
export const updateQuestion: RequestHandler = async (req, res) => { res.json(await svc.updateQuestion(id(req), req.body)); };
export const deleteQuestion: RequestHandler = async (req, res) => { res.json(await svc.deleteQuestion(id(req))); };
export const preview: RequestHandler = async (req, res) => {
  res.json(await svc.previewQuestions(req.body.categoryId, req.body.complexity, req.body.count));
};
