import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { createAdminSchema } from '../auth/auth.schema';
import * as ctrl from './admins.controller';

/** Admin: mounted under /api/admin (auth + admin role applied by parent). */
export const adminsAdminRouter = Router();
adminsAdminRouter.get('/admins', ctrl.list);
adminsAdminRouter.post('/admins', validateBody(createAdminSchema), ctrl.create);
