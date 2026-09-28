import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uuidParam, validate } from '../../common/middlewares/validate.middleware';
import { practiceController } from './practice.controller';
import { submitPracticeSchema } from './practice.validation';

// Mounted at /practice-tests
export const practiceTestsRouter = Router();
practiceTestsRouter.post(
  '/:practiceTestId/attempts',
  authenticate,
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('practiceTestId') }),
  practiceController.start,
);

// Mounted at /practice-attempts
export const practiceAttemptsRouter = Router();
practiceAttemptsRouter.post(
  '/:attemptId/submit',
  authenticate,
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('attemptId'), body: submitPracticeSchema }),
  practiceController.submit,
);
