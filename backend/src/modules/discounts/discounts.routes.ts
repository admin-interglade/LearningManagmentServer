import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { discountSchema, validateDiscountSchema } from './discounts.schema';
import * as ctrl from './discounts.controller';

export const discountsAdminRouter = Router();
discountsAdminRouter.get('/discounts', ctrl.list);
discountsAdminRouter.post('/discounts', validateBody(discountSchema), ctrl.create);
discountsAdminRouter.put('/discounts/:id', validateBody(discountSchema), ctrl.update);
discountsAdminRouter.delete('/discounts/:id', ctrl.remove);

export const discountsStudentRouter = Router();
discountsStudentRouter.post('/discounts/validate', validateBody(validateDiscountSchema), ctrl.validate);
