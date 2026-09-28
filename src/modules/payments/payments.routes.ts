import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { paymentsController } from './payments.controller';
import { createOrderSchema, verifyPaymentSchema } from './payments.validation';

const router = Router();

router.use(authenticate, authorize(ROLES.STUDENT));

router.post('/razorpay/order', validate({ body: createOrderSchema }), paymentsController.createOrder);
router.post('/razorpay/verify', validate({ body: verifyPaymentSchema }), paymentsController.verify);

export default router;
