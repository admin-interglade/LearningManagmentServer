import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uuidParam, validate } from '../../common/middlewares/validate.middleware';
import { notificationsController } from './notifications.controller';
import { raiseEventSchema } from './notifications.validation';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.post('/events', validate({ body: raiseEventSchema }), notificationsController.raiseEvent);
router.post('/:notificationId/retry', validate({ params: uuidParam('notificationId') }), notificationsController.retry);

export default router;
