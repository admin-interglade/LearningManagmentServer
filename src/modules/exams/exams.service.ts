import { AppError } from '../../common/errors/app-error';
import { ROLES, RoleName } from '../../common/constants/roles';
import { paginated } from '../../common/utils/pagination';
import { AuthUser } from '../../common/middlewares/auth.middleware';
import { AppDataSource } from '../../config/data-source';
import { Registration } from '../registrations/entities/registration.entity';
import { examsRepository } from './exams.repository';
import {
  CreateCategoryBody,
  CreateExamBody,
  CreateLevelBody,
  examWindowErrors,
  ListExamsQuery,
  UpdateExamBody,
  UpdateLevelBody,
} from './exams.validation';

const isAdmin = (role: RoleName) => role === ROLES.ADMIN;

const list = async (query: ListExamsQuery, user: AuthUser) => {
  const [items, total] = await examsRepository.list({ ...query, publishedOnly: !isAdmin(user.role) });
  return paginated(items, total, query);
};

const getDetail = async (examId: string, user: AuthUser) => {
  const exam = await examsRepository.findDetail(examId);
  if (!exam || (!exam.isPublished && !isAdmin(user.role))) throw AppError.notFound('Exam not found');
  return exam;
};

// Students may only act on exams they can see
const getVisibleExam = async (examId: string, user: AuthUser) => {
  const exam = await examsRepository.findById(examId);
  if (!exam || (!exam.isPublished && !isAdmin(user.role))) throw AppError.notFound('Exam not found');
  return exam;
};

const create = (body: CreateExamBody, adminId: string) =>
  examsRepository.create({
    name: body.name,
    description: body.description ?? null,
    syllabus: body.syllabus ?? null,
    registrationStart: body.registration_start,
    registrationEnd: body.registration_end,
    examStart: body.exam_start,
    examEnd: body.exam_end,
    fee: body.fee,
    currency: body.currency,
    status: body.status,
    isPublished: body.is_published,
    award: body.award ?? null,
    createdBy: adminId,
  });

const update = async (examId: string, body: UpdateExamBody) => {
  const exam = await examsRepository.findById(examId);
  if (!exam) throw AppError.notFound('Exam not found');

  const errors = examWindowErrors({
    registration_start: body.registration_start ?? exam.registrationStart,
    registration_end: body.registration_end ?? exam.registrationEnd,
    exam_start: body.exam_start ?? exam.examStart,
    exam_end: body.exam_end ?? exam.examEnd,
  });
  if (errors.length) throw AppError.badRequest('Invalid exam schedule', errors);

  if (body.name !== undefined) exam.name = body.name;
  if (body.description !== undefined) exam.description = body.description ?? null;
  if (body.syllabus !== undefined) exam.syllabus = body.syllabus ?? null;
  if (body.registration_start) exam.registrationStart = body.registration_start;
  if (body.registration_end) exam.registrationEnd = body.registration_end;
  if (body.exam_start) exam.examStart = body.exam_start;
  if (body.exam_end) exam.examEnd = body.exam_end;
  if (body.fee !== undefined) exam.fee = body.fee;
  if (body.currency) exam.currency = body.currency;
  if (body.status) exam.status = body.status;
  if (body.is_published !== undefined) exam.isPublished = body.is_published;
  if (body.award !== undefined) exam.award = body.award ?? null;
  return examsRepository.save(exam);
};

const setPublished = async (examId: string, isPublished: boolean) => {
  const exam = await examsRepository.findById(examId);
  if (!exam) throw AppError.notFound('Exam not found');
  if (isPublished) {
    const levels = await examsRepository.findLevelsByExam(examId);
    if (levels.length === 0) throw AppError.badRequest('Add at least one level before publishing the exam');
  }
  exam.isPublished = isPublished;
  return examsRepository.save(exam);
};

const remove = async (examId: string) => {
  await AppDataSource.transaction(async (manager) => {
    const exam = await examsRepository.findById(examId, manager);
    if (!exam) throw AppError.notFound('Exam not found');
    const registrations = await manager.count(Registration, { where: { examId } });
    if (registrations > 0) {
      throw AppError.conflict('Exam has registrations and cannot be deleted; unpublish or cancel it instead');
    }
    await examsRepository.remove(exam, manager);
  });
  return { examId, deleted: true };
};

const createLevel = async (examId: string, body: CreateLevelBody) => {
  const exam = await examsRepository.findById(examId);
  if (!exam) throw AppError.notFound('Exam not found');
  if (await examsRepository.findLevelByNumber(examId, body.level_number)) {
    throw AppError.conflict(`Level ${body.level_number} already exists for this exam`);
  }
  return examsRepository.createLevel({
    examId,
    levelNumber: body.level_number,
    name: body.name ?? `Level ${body.level_number}`,
    durationMinutes: body.duration_minutes,
    questionCount: body.question_count,
    maxScore: body.max_score,
    attemptsAllowed: body.attempts_allowed,
  });
};

const updateLevel = async (levelId: string, body: UpdateLevelBody) => {
  const level = await examsRepository.findLevelById(levelId);
  if (!level) throw AppError.notFound('Level not found');

  if (body.level_number !== undefined && body.level_number !== level.levelNumber) {
    if (await examsRepository.findLevelByNumber(level.examId, body.level_number)) {
      throw AppError.conflict(`Level ${body.level_number} already exists for this exam`);
    }
    level.levelNumber = body.level_number;
  }
  if (body.name !== undefined) level.name = body.name;
  if (body.duration_minutes !== undefined) level.durationMinutes = body.duration_minutes;
  if (body.question_count !== undefined) level.questionCount = body.question_count;
  if (body.max_score !== undefined) level.maxScore = body.max_score;
  if (body.attempts_allowed !== undefined) level.attemptsAllowed = body.attempts_allowed;

  const { exam: _exam, ...saved } = await examsRepository.saveLevel(level);
  return saved;
};

const createCategory = async (levelId: string, body: CreateCategoryBody) => {
  const level = await examsRepository.findLevelById(levelId);
  if (!level) throw AppError.notFound('Level not found');
  return examsRepository.createCategory({
    levelId,
    categoryName: body.category_name,
    complexity: body.complexity,
    marksPerQuestion: body.marks_per_question,
    negativeMarking: body.negative_marking,
  });
};

export const examsService = {
  list,
  getDetail,
  getVisibleExam,
  create,
  update,
  setPublished,
  remove,
  createLevel,
  updateLevel,
  createCategory,
};
