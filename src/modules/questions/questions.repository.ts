import { EntityManager, In } from 'typeorm';
import { repo } from '../../common/utils/db';
import { Question } from './entities/question.entity';
import { QuestionOption } from './entities/question-option.entity';
import { LevelQuestion } from './entities/level-question.entity';
import { AttemptQuestion } from '../attempts/entities/attempt-question.entity';

export const questionsRepository = {
  findById: (questionId: string, manager?: EntityManager) =>
    repo(Question, manager).findOne({
      where: { questionId },
      relations: { options: true, levelQuestions: true },
    }),

  save: (question: Partial<Question>, manager?: EntityManager) => repo(Question, manager).save(question as Question),

  replaceOptions: async (questionId: string, options: Partial<QuestionOption>[], manager: EntityManager) => {
    await repo(QuestionOption, manager).delete({ questionId });
    return repo(QuestionOption, manager).save(options.map((o) => repo(QuestionOption, manager).create({ ...o, questionId })));
  },

  replaceLevelLinks: async (questionId: string, links: Partial<LevelQuestion>[], manager: EntityManager) => {
    await repo(LevelQuestion, manager).delete({ questionId });
    return repo(LevelQuestion, manager).save(links.map((l) => repo(LevelQuestion, manager).create({ ...l, questionId })));
  },

  isUsedInAttempts: (questionId: string, manager?: EntityManager) =>
    repo(AttemptQuestion, manager).exists({ where: { questionId } }),

  // Question pool for paper generation: active questions linked to the given categories
  findPoolByCategories: (levelCategoryIds: string[], manager?: EntityManager) =>
    levelCategoryIds.length === 0
      ? Promise.resolve([])
      : repo(LevelQuestion, manager)
          .createQueryBuilder('lq')
          .innerJoinAndSelect('lq.question', 'question')
          .where('lq.levelCategoryId IN (:...levelCategoryIds)', { levelCategoryIds })
          .andWhere('question.isActive = true')
          .orderBy('lq.levelQuestionId', 'ASC')
          .getMany(),

  findWithOptionsByIds: (questionIds: string[], manager?: EntityManager) =>
    questionIds.length === 0
      ? Promise.resolve([])
      : repo(Question, manager).find({ where: { questionId: In(questionIds) }, relations: { options: true } }),
};
