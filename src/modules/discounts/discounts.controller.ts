import { Request, Response } from 'express';
import { created, ok } from '../../common/utils/response';
import { discountsService } from './discounts.service';

export const discountsController = {
  async create(req: Request, res: Response) {
    created(res, await discountsService.create(req.body), 'Discount created');
  },

  async update(req: Request, res: Response) {
    ok(res, await discountsService.update(req.params.discountId as string, req.body), 'Discount updated');
  },
};
