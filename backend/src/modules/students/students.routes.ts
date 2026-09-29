import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { patchStudentSchema, registerSchema } from '../users/users.schema';
import * as ctrl from './students.controller';

export const studentsAdminRouter = Router();
studentsAdminRouter.get('/students', ctrl.list);
studentsAdminRouter.get('/students/:id', ctrl.get);
studentsAdminRouter.post('/students', validateBody(registerSchema), ctrl.create);
studentsAdminRouter.patch('/students/:id', validateBody(patchStudentSchema), ctrl.update);
