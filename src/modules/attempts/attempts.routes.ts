import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uuidParam, validate } from '../../common/middlewares/validate.middleware';
import { attemptsController } from './attempts.controller';
import { saveAnswerSchema, submitAttemptSchema } from './attempts.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/:attemptId/questions',
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('attemptId') }),
  attemptsController.getQuestions,
);
router.put(
  '/:attemptId/questions/:attemptQuestionId',
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('attemptId', 'attemptQuestionId'), body: saveAnswerSchema }),
  attemptsController.saveAnswer,
);
router.post(
  '/:attemptId/submit',
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('attemptId'), body: submitAttemptSchema }),
  attemptsController.submit,
);
router.get(
  '/:attemptId/result',
  authorize(ROLES.STUDENT, ROLES.ADMIN),
  validate({ params: uuidParam('attemptId') }),
  attemptsController.getResult,
);

export default router;
