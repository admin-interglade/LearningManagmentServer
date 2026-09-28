import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { ok } from '../../common/utils/response';
import { studentsService } from './students.service';

export const studentsController = {
  async dashboard(req: Request, res: Response) {
    ok(res, await studentsService.dashboard(currentUser(req).userId));
  },
};
