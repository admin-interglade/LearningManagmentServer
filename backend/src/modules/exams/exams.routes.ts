import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { examInputSchema, publishSchema, slotSchema } from './exams.schema';
import * as ctrl from './exams.controller';

/** Admin: mounted under /api/admin (auth + admin role applied by parent). */
export const examsAdminRouter = Router();
examsAdminRouter.get('/exams', ctrl.list);
examsAdminRouter.post('/exams', validateBody(examInputSchema), ctrl.create);
examsAdminRouter.get('/exams/:id', ctrl.get);
examsAdminRouter.put('/exams/:id', validateBody(examInputSchema), ctrl.update);
examsAdminRouter.delete('/exams/:id', ctrl.remove);
examsAdminRouter.post('/exams/:id/publish', validateBody(publishSchema), ctrl.publish);
examsAdminRouter.get('/exams/:id/registrations', ctrl.registrations);
examsAdminRouter.get('/exams/:id/leaderboard', ctrl.leaderboard);
examsAdminRouter.get('/exams/:id/report', ctrl.report);
examsAdminRouter.post('/exams/:examId/slots', validateBody(slotSchema), ctrl.createSlot);
examsAdminRouter.put('/slots/:slotId', validateBody(slotSchema), ctrl.updateSlot);
examsAdminRouter.delete('/slots/:slotId', ctrl.deleteSlot);
