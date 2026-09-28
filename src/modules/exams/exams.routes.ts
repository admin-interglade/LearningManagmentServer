import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uuidParam, validate } from '../../common/middlewares/validate.middleware';
import { examsController } from './exams.controller';
import { listExamsQuerySchema } from './exams.validation';
import { resultsController } from '../results/results.controller';
import { leaderboardQuerySchema } from '../results/results.validation';
import { attemptsController } from '../attempts/attempts.controller';
import { startAttemptSchema } from '../attempts/attempts.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listExamsQuerySchema }), examsController.list);
router.get('/:examId', validate({ params: uuidParam('examId') }), examsController.getDetail);
router.get(
  '/:examId/leaderboard',
  validate({ params: uuidParam('examId'), query: leaderboardQuerySchema }),
  resultsController.getLeaderboard,
);
router.post(
  '/:examId/attempts',
  authorize(ROLES.STUDENT),
  validate({ params: uuidParam('examId'), body: startAttemptSchema }),
  attemptsController.start,
);

export default router;
