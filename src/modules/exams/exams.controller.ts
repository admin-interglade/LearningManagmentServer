import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created, ok } from '../../common/utils/response';
import { examsService } from './exams.service';
import { ListExamsQuery } from './exams.validation';

export const examsController = {
  async list(req: Request, res: Response) {
    ok(res, await examsService.list(req.query as unknown as ListExamsQuery, currentUser(req)));
  },

  async getDetail(req: Request, res: Response) {
    ok(res, await examsService.getDetail(req.params.examId as string, currentUser(req)));
  },

  async create(req: Request, res: Response) {
    created(res, await examsService.create(req.body, currentUser(req).userId), 'Exam created');
  },

  async update(req: Request, res: Response) {
    ok(res, await examsService.update(req.params.examId as string, req.body), 'Exam updated');
  },

  async setPublished(req: Request, res: Response) {
    const exam = await examsService.setPublished(req.params.examId as string, req.body.is_published);
    ok(res, exam, exam.isPublished ? 'Exam published' : 'Exam hidden');
  },

  async remove(req: Request, res: Response) {
    ok(res, await examsService.remove(req.params.examId as string), 'Exam deleted');
  },

  async createLevel(req: Request, res: Response) {
    created(res, await examsService.createLevel(req.params.examId as string, req.body), 'Level created');
  },

  async updateLevel(req: Request, res: Response) {
    ok(res, await examsService.updateLevel(req.params.levelId as string, req.body), 'Level updated');
  },

  async createCategory(req: Request, res: Response) {
    created(res, await examsService.createCategory(req.params.levelId as string, req.body), 'Category created');
  },
};
