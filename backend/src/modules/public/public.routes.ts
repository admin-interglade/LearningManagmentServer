import { Router } from 'express';
import * as ctrl from './public.controller';

export const publicRouter = Router();
publicRouter.get('/exams', ctrl.listExams);
publicRouter.get('/exams/:id', ctrl.getExam);
publicRouter.get('/stats', ctrl.stats);
