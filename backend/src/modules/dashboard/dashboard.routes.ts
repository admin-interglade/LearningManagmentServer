import { Router } from 'express';
import * as ctrl from './dashboard.controller';

export const dashboardAdminRouter = Router();
dashboardAdminRouter.get('/dashboard/summary', ctrl.summary);
dashboardAdminRouter.get('/dashboard/exams', ctrl.exams);
