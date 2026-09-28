import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created, ok } from '../../common/utils/response';
import { attemptsService } from './attempts.service';

export const attemptsController = {
  async start(req: Request, res: Response) {
    const data = await attemptsService.start(req.params.examId as string, currentUser(req).userId, req.body);
    if (data.resumed) ok(res, data, 'Resuming attempt in progress');
    else created(res, data, 'Attempt started');
  },

  async getQuestions(req: Request, res: Response) {
    ok(res, await attemptsService.getQuestions(req.params.attemptId as string, currentUser(req)));
  },

  async saveAnswer(req: Request, res: Response) {
    const { attemptId, attemptQuestionId } = req.params as Record<string, string>;
    ok(res, await attemptsService.saveAnswer(attemptId, attemptQuestionId, currentUser(req), req.body), 'Answer saved');
  },

  async submit(req: Request, res: Response) {
    const data = await attemptsService.submit(req.params.attemptId as string, currentUser(req), req.body);
    ok(res, data, data.alreadySubmitted ? 'Attempt was already submitted' : 'Attempt submitted');
  },

  async getResult(req: Request, res: Response) {
    ok(res, await attemptsService.getResult(req.params.attemptId as string, currentUser(req)));
  },
};
