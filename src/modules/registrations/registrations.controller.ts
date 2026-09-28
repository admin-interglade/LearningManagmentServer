import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { created } from '../../common/utils/response';
import { registrationsService } from './registrations.service';

export const registrationsController = {
  async create(req: Request, res: Response) {
    const registration = await registrationsService.create(currentUser(req).userId, req.body);
    created(res, registration, registration.paymentRequired ? 'Registered; payment pending' : 'Registration confirmed');
  },
};
