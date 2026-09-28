import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created, ok } from '../../common/utils/response';
import { authService } from './auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    created(res, await authService.register(req.body), 'Registration successful');
  },

  async login(req: Request, res: Response) {
    ok(res, await authService.login(req.body), 'Login successful');
  },

  async forgotPassword(req: Request, res: Response) {
    ok(res, await authService.forgotPassword(req.body));
  },

  async resetPassword(req: Request, res: Response) {
    ok(res, await authService.resetPassword(req.body));
  },

  async changePassword(req: Request, res: Response) {
    ok(res, await authService.changePassword(currentUser(req).userId, req.body));
  },
};
