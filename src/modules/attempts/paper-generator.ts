import { EntityManager } from 'typeorm';
import { AppError } from '../../common/errors/app-error';
import { seededShuffle } from '../../common/utils/seeded-random';
import { examsRepository } from '../exams/exams.repository';
import { questionsRepository } from '../questions/questions.repository';
import { QuestionOption } from '../questions/entities/question-option.entity';

/**
 * Builds a level paper from its blueprint: each category's question pool is shuffled with the
 * attempt seed, then questions are drawn round-robin across categories so every category is
 * represented, and the final order is shuffled again. Same seed + same bank = same paper.
 */
export const generatePaper = async (levelId: string, questionCount: number, seed: number, manager: EntityManager) => {
  const categories = (await examsRepository.findCategoriesByLevel(levelId, manager)).sort((a, b) =>
    a.levelCategoryId.localeCompare(b.levelCategoryId),
  );
  if (categories.length === 0) throw AppError.conflict('This level has no question categories configured');

  const pool = await questionsRepository.findPoolByCategories(
    categories.map((c) => c.levelCategoryId),
    manager,
  );

  const buckets = categories.map((category, index) =>
    seededShuffle(
      pool.filter((lq) => lq.levelCategoryId === category.levelCategoryId).map((lq) => lq.questionId),
      seed + index,
    ),
  );

  const picked = new Set<string>();
  let progressed = true;
  while (picked.size < questionCount && progressed) {
    progressed = false;
    for (const bucket of buckets) {
      if (picked.size >= questionCount) break;
      const next = bucket.find((id) => !picked.has(id));
      if (next) {
        picked.add(next);
        progressed = true;
      }
    }
  }

  if (picked.size < questionCount) {
    throw AppError.conflict(
      `Question bank has only ${picked.size} active questions for this level; ${questionCount} are required`,
    );
  }
  return seededShuffle([...picked], seed ^ 0x5f3759df);
};

// Options are shown in a per-attempt, per-question stable order without storing it
export const orderOptions = (options: QuestionOption[], seed: number, questionOrder: number) =>
  seededShuffle(
    [...options].sort((a, b) => a.optionId.localeCompare(b.optionId)),
    seed + questionOrder * 7919,
  );
