import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { registrationsController } from './registrations.controller';
import { createRegistrationSchema } from './registrations.validation';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(ROLES.STUDENT),
  validate({ body: createRegistrationSchema }),
  registrationsController.create,
);

export default router;
