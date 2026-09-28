import { Request, Response } from 'express';
import { created, ok } from '../../common/utils/response';
import { questionsService } from './questions.service';

export const questionsController = {
  async create(req: Request, res: Response) {
    created(res, await questionsService.create(req.body), 'Question created');
  },

  async update(req: Request, res: Response) {
    ok(res, await questionsService.update(req.params.questionId as string, req.body), 'Question updated');
  },
};
