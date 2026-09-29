import { Router } from 'express';
import { authenticate, requireRole } from './common/auth.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { profileRouter } from './modules/users/users.routes';
import { publicRouter } from './modules/public/public.routes';
import { categoriesRouter, questionBankAdminRouter } from './modules/question-bank/question-bank.routes';
import { examsAdminRouter } from './modules/exams/exams.routes';
import { discountsAdminRouter, discountsStudentRouter } from './modules/discounts/discounts.routes';
import { paymentSettingsAdminRouter, paymentsRouter, paymentsStudentRouter } from './modules/payments/payments.routes';
import { registrationsStudentRouter } from './modules/registrations/registrations.routes';
import { attemptsRouter } from './modules/attempts/attempts.routes';
import { dashboardAdminRouter } from './modules/dashboard/dashboard.routes';
import { studentsAdminRouter } from './modules/students/students.routes';
import { adminsAdminRouter } from './modules/admins/admins.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => { res.json({ ok: true }); });
apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/public', publicRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/attempts', attemptsRouter);

const student = Router();
student.use(authenticate, requireRole('student'));
student.use(registrationsStudentRouter, discountsStudentRouter, paymentsStudentRouter);
apiRouter.use('/student', student);

const admin = Router();
admin.use(authenticate, requireRole('admin'));
admin.use(dashboardAdminRouter, examsAdminRouter, questionBankAdminRouter, discountsAdminRouter, paymentSettingsAdminRouter, studentsAdminRouter, adminsAdminRouter);
apiRouter.use('/admin', admin);
