import { Router } from 'express';
import { validateBody } from '../../common/validate';
import { categorySchema, previewSchema, questionSchema } from './question-bank.schema';
import * as ctrl from './question-bank.controller';

/** Public: GET /api/categories */
export const categoriesRouter = Router();
categoriesRouter.get('/', ctrl.listCategories);

/** Admin: mounted under /api/admin (auth + admin role applied by parent). */
export const questionBankAdminRouter = Router();
questionBankAdminRouter.get('/categories', ctrl.listCategories);
questionBankAdminRouter.post('/categories', validateBody(categorySchema), ctrl.createCategory);
questionBankAdminRouter.put('/categories/:id', validateBody(categorySchema), ctrl.updateCategory);
questionBankAdminRouter.get('/questions', ctrl.listQuestions);
questionBankAdminRouter.post('/questions/preview', validateBody(previewSchema), ctrl.preview);
questionBankAdminRouter.post('/questions', validateBody(questionSchema), ctrl.createQuestion);
questionBankAdminRouter.put('/questions/:id', validateBody(questionSchema), ctrl.updateQuestion);
questionBankAdminRouter.delete('/questions/:id', ctrl.deleteQuestion);
