import { AppError } from '../../common/errors/app-error';
import { transaction } from '../../common/utils/db';
import { examsRepository } from '../exams/exams.repository';
import { EntityManager } from 'typeorm';
import { questionsRepository } from './questions.repository';
import { CreateQuestionBody, UpdateQuestionBody } from './questions.validation';

type LevelLinks = CreateQuestionBody['level_categories'];

const assertCategories = async (links: LevelLinks, complexity: string, manager: EntityManager) => {
  const ids = links.map((l) => l.level_category_id);
  const categories = await examsRepository.findCategoriesByIds(ids, manager);
  const missing = ids.filter((id) => !categories.some((c) => c.levelCategoryId === id));
  if (missing.length) throw AppError.badRequest('Unknown level_category_id', missing);

  // A category defines the complexity of the questions it draws from
  const mismatched = categories.filter((c) => c.complexity !== complexity).map((c) => c.levelCategoryId);
  if (mismatched.length) {
    throw AppError.badRequest(`Question complexity '${complexity}' does not match these categories`, mismatched);
  }
};

const toOptionRows = (options: CreateQuestionBody['options']) =>
  options.map((o) => ({ optionText: o.option_text, isCorrect: o.is_correct }));

const toLinkRows = (links: LevelLinks) =>
  links.map((l) => ({ levelCategoryId: l.level_category_id, weightage: l.weightage }));

const create = (body: CreateQuestionBody) =>
  transaction(async (manager) => {
    await assertCategories(body.level_categories, body.complexity, manager);
    const question = await questionsRepository.save(
      { questionText: body.question_text, complexity: body.complexity, explanation: body.explanation ?? null, isActive: body.is_active },
      manager,
    );
    await questionsRepository.replaceOptions(question.questionId, toOptionRows(body.options), manager);
    await questionsRepository.replaceLevelLinks(question.questionId, toLinkRows(body.level_categories), manager);
    return questionsRepository.findById(question.questionId, manager);
  });

const update = (questionId: string, body: UpdateQuestionBody) =>
  transaction(async (manager) => {
    const question = await questionsRepository.findById(questionId, manager);
    if (!question) throw AppError.notFound('Question not found');

    const complexity = body.complexity ?? question.complexity;
    if (body.options) {
      // Replacing options would orphan answers students already gave
      if (await questionsRepository.isUsedInAttempts(questionId, manager)) {
        throw AppError.conflict('Question already appears in exam attempts; its options can no longer be changed. Deactivate it and create a new one.');
      }
      await questionsRepository.replaceOptions(questionId, toOptionRows(body.options), manager);
    }

    const links =
      body.level_categories ??
      (body.complexity ? question.levelQuestions.map((l) => ({ level_category_id: l.levelCategoryId, weightage: l.weightage })) : null);
    if (links) {
      await assertCategories(links, complexity, manager);
      if (body.level_categories) await questionsRepository.replaceLevelLinks(questionId, toLinkRows(links), manager);
    }

    await questionsRepository.save(
      {
        questionId,
        questionText: body.question_text ?? question.questionText,
        complexity,
        explanation: body.explanation !== undefined ? (body.explanation ?? null) : question.explanation,
        isActive: body.is_active ?? question.isActive,
      },
      manager,
    );
    return questionsRepository.findById(questionId, manager);
  });

export const questionsService = { create, update };
