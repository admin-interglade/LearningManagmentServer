import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { createRegistrationSchema, selectSlotSchema } from './registrations.schema';
import * as ctrl from './registrations.controller';

/** Student: mounted under /api/student (auth + student role applied by parent). */
export const registrationsStudentRouter = Router();
registrationsStudentRouter.get('/dashboard', ctrl.dashboard);
registrationsStudentRouter.get('/registrations', ctrl.list);
registrationsStudentRouter.post('/registrations', validateBody(createRegistrationSchema), ctrl.create);
registrationsStudentRouter.get('/registrations/:id', ctrl.detail);
registrationsStudentRouter.put('/registrations/:id/slot', validateBody(selectSlotSchema), ctrl.selectSlot);
registrationsStudentRouter.get('/exams/:examId/leaderboard', ctrl.leaderboard);
