import { Router } from 'express';
import { authenticate } from '../../common/auth.middleware';
import { validateBody } from '../../common/validate';
import { updateProfileSchema } from './users.schema';
import * as ctrl from './users.controller';

export const profileRouter = Router();
profileRouter.use(authenticate);
profileRouter.get('/', ctrl.getProfile);
profileRouter.put('/', validateBody(updateProfileSchema), ctrl.updateProfile);
