import { Request, Response } from 'express';
import { ok } from '../../common/utils/response';
import { adminService } from './admin.service';

export const adminController = {
  async dashboard(_req: Request, res: Response) {
    ok(res, await adminService.dashboard());
  },

  async examReport(req: Request, res: Response) {
    ok(res, await adminService.examReport(req.params.examId as string));
  },
};
