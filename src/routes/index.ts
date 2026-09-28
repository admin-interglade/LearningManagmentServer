import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import examsRoutes from '../modules/exams/exams.routes';
import adminRoutes from '../modules/admin/admin.routes';
import { practiceAttemptsRouter, practiceTestsRouter } from '../modules/practice/practice.routes';
import registrationsRoutes from '../modules/registrations/registrations.routes';
import paymentsRoutes from '../modules/payments/payments.routes';
import studentsRoutes from '../modules/students/students.routes';
import attemptsRoutes from '../modules/attempts/attempts.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK', data: { status: 'up', time: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/exams', examsRoutes);
router.use('/admin', adminRoutes);
router.use('/practice-tests', practiceTestsRouter);
router.use('/practice-attempts', practiceAttemptsRouter);
router.use('/registrations', registrationsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/students', studentsRoutes);
router.use('/attempts', attemptsRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
