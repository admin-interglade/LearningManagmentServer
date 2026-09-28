import { Router } from 'express';
import { ROLES } from '../../common/constants/roles';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uuidParam, validate } from '../../common/middlewares/validate.middleware';
import { adminController } from './admin.controller';
import { examsController } from '../exams/exams.controller';
import {
  createCategorySchema,
  createExamSchema,
  createLevelSchema,
  publishExamSchema,
  updateExamSchema,
  updateLevelSchema,
} from '../exams/exams.validation';
import { questionsController } from '../questions/questions.controller';
import { createQuestionSchema, updateQuestionSchema } from '../questions/questions.validation';
import { practiceController } from '../practice/practice.controller';
import { configurePracticeSchema } from '../practice/practice.validation';
import { discountsController } from '../discounts/discounts.controller';
import { createDiscountSchema, updateDiscountSchema } from '../discounts/discounts.validation';

// Every /admin route is admin-only; handlers live in their domain modules
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

// Dashboard & reports
router.get('/dashboard', adminController.dashboard);
router.get('/exams/:examId/reports', validate({ params: uuidParam('examId') }), adminController.examReport);

// Exams
router.post('/exams', validate({ body: createExamSchema }), examsController.create);
router.put('/exams/:examId', validate({ params: uuidParam('examId'), body: updateExamSchema }), examsController.update);
router.patch(
  '/exams/:examId/publish',
  validate({ params: uuidParam('examId'), body: publishExamSchema }),
  examsController.setPublished,
);
router.delete('/exams/:examId', validate({ params: uuidParam('examId') }), examsController.remove);

// Levels & categories
router.post(
  '/exams/:examId/levels',
  validate({ params: uuidParam('examId'), body: createLevelSchema }),
  examsController.createLevel,
);
router.put('/levels/:levelId', validate({ params: uuidParam('levelId'), body: updateLevelSchema }), examsController.updateLevel);
router.post(
  '/levels/:levelId/categories',
  validate({ params: uuidParam('levelId'), body: createCategorySchema }),
  examsController.createCategory,
);

// Question bank
router.post('/questions', validate({ body: createQuestionSchema }), questionsController.create);
router.put(
  '/questions/:questionId',
  validate({ params: uuidParam('questionId'), body: updateQuestionSchema }),
  questionsController.update,
);

// Practice tests
router.post('/practice-tests', validate({ body: configurePracticeSchema }), practiceController.configure);

// Discounts
router.post('/discounts', validate({ body: createDiscountSchema }), discountsController.create);
router.put(
  '/discounts/:discountId',
  validate({ params: uuidParam('discountId'), body: updateDiscountSchema }),
  discountsController.update,
);

export default router;
