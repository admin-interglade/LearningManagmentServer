import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { toSkipTake } from '../../common/utils/pagination';
import { Exam } from './entities/exam.entity';
import { ExamLevel } from './entities/exam-level.entity';
import { LevelCategory } from './entities/level-category.entity';

interface ListFilters {
  status?: string;
  search?: string;
  page: number;
  size: number;
  publishedOnly: boolean;
}

export const examsRepository = {
  list: ({ status, search, page, size, publishedOnly }: ListFilters) => {
    const qb = repo(Exam).createQueryBuilder('exam').orderBy('exam.examStart', 'ASC');
    if (publishedOnly) qb.andWhere('exam.isPublished = true');
    if (status) qb.andWhere('exam.status = :status', { status });
    if (search) qb.andWhere('(exam.name ILIKE :search OR exam.description ILIKE :search)', { search: `%${search}%` });
    const { skip, take } = toSkipTake({ page, size });
    return qb.skip(skip).take(take).getManyAndCount();
  },

  findById: (examId: string, manager?: EntityManager) => repo(Exam, manager).findOne({ where: { examId } }),

  findDetail: (examId: string) =>
    repo(Exam)
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.levels', 'level')
      .leftJoinAndSelect('level.categories', 'category')
      .leftJoinAndSelect('exam.practiceTest', 'practiceTest')
      .where('exam.examId = :examId', { examId })
      .orderBy('level.levelNumber', 'ASC')
      .addOrderBy('category.categoryName', 'ASC')
      .getOne(),

  create: (data: Partial<Exam>) => repo(Exam).save(repo(Exam).create(data)),

  save: (exam: Exam, manager?: EntityManager) => repo(Exam, manager).save(exam),

  remove: (exam: Exam, manager?: EntityManager) => repo(Exam, manager).remove(exam),

  countByStatus: () =>
    repo(Exam)
      .createQueryBuilder('exam')
      .select('exam.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('exam.status')
      .getRawMany<{ status: string; count: number }>(),

  // Levels
  findLevelById: (levelId: string, manager?: EntityManager) =>
    repo(ExamLevel, manager).findOne({ where: { levelId }, relations: { exam: true } }),

  findLevelByNumber: (examId: string, levelNumber: number) =>
    repo(ExamLevel).findOne({ where: { examId, levelNumber } }),

  findLevelsByExam: (examId: string) => repo(ExamLevel).find({ where: { examId }, order: { levelNumber: 'ASC' } }),

  createLevel: (data: Partial<ExamLevel>) => repo(ExamLevel).save(repo(ExamLevel).create(data)),

  saveLevel: (level: ExamLevel) => repo(ExamLevel).save(level),

  // Categories
  findCategoryById: (levelCategoryId: string, manager?: EntityManager) =>
    repo(LevelCategory, manager).findOne({ where: { levelCategoryId } }),

  findCategoriesByIds: (ids: string[], manager?: EntityManager) =>
    ids.length === 0
      ? Promise.resolve([])
      : repo(LevelCategory, manager).createQueryBuilder('c').where('c.levelCategoryId IN (:...ids)', { ids }).getMany(),

  findCategoriesByLevel: (levelId: string, manager?: EntityManager) =>
    repo(LevelCategory, manager).find({ where: { levelId } }),

  createCategory: (data: Partial<LevelCategory>) => repo(LevelCategory).save(repo(LevelCategory).create(data)),
};
