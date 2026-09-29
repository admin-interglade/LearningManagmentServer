import { Router } from 'express';
import { authenticate } from '../../common/auth.middleware';
import { validateBody } from '../../common/validate';
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from './auth.schema';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), ctrl.register);
authRouter.post('/login', validateBody(loginSchema), ctrl.login);
authRouter.get('/me', authenticate, ctrl.me);
authRouter.post('/forgot-password', validateBody(forgotSchema), ctrl.forgotPassword);
authRouter.post('/reset-password', validateBody(resetSchema), ctrl.resetPassword);
authRouter.post('/change-password', authenticate, validateBody(changePasswordSchema), ctrl.changePassword);
