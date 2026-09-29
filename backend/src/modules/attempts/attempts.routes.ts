import { Router } from 'express';
import { authenticate, requireRole } from '../../common/auth.middleware';
import { validateBody } from '../../common/validate';
import { answerSchema, startAttemptSchema } from './attempts.schema';
import * as ctrl from './attempts.controller';

export const attemptsRouter = Router();
attemptsRouter.use(authenticate, requireRole('student'));
attemptsRouter.post('/', validateBody(startAttemptSchema), ctrl.start);
attemptsRouter.get('/:id', ctrl.get);
attemptsRouter.put('/:id/answers', validateBody(answerSchema), ctrl.answer);
attemptsRouter.post('/:id/submit', ctrl.submit);
