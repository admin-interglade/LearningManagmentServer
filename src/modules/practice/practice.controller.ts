import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created, ok } from '../../common/utils/response';
import { practiceService } from './practice.service';

export const practiceController = {
  async configure(req: Request, res: Response) {
    const { practiceTest, created: isNew } = await practiceService.configure(req.body);
    if (isNew) created(res, practiceTest, 'Practice test configured');
    else ok(res, practiceTest, 'Practice test updated');
  },

  async start(req: Request, res: Response) {
    const data = await practiceService.start(req.params.practiceTestId as string, currentUser(req).userId);
    if (data.resumed) ok(res, data, 'Resuming practice attempt');
    else created(res, data, 'Practice attempt started');
  },

  async submit(req: Request, res: Response) {
    ok(res, await practiceService.submit(req.params.attemptId as string, currentUser(req).userId, req.body), 'Practice submitted');
  },
};
