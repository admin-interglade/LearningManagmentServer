import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created, ok } from '../../common/utils/response';
import { paymentsService } from './payments.service';

export const paymentsController = {
  async createOrder(req: Request, res: Response) {
    created(res, await paymentsService.createOrder(currentUser(req).userId, req.body), 'Razorpay order created');
  },

  async verify(req: Request, res: Response) {
    ok(res, await paymentsService.verify(currentUser(req).userId, req.body), 'Payment verified');
  },
};
