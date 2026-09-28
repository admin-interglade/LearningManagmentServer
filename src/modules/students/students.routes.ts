import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { studentsController } from './students.controller';

const router = Router();

router.get('/dashboard', authenticate, authorize(ROLES.STUDENT), studentsController.dashboard);

export default router;
