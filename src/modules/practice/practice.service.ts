import { EntityManager } from 'typeorm';
import { AppError } from '../../common/errors/app-error';
import { ATTEMPT_STATUS } from '../../common/constants/statuses';
import { transaction } from '../../common/utils/db';
import { seededShuffle, seedFromUuid } from '../../common/utils/seeded-random';
import { examsRepository } from '../exams/exams.repository';
import { questionsRepository } from '../questions/questions.repository';
import { registrationsRepository } from '../registrations/registrations.repository';
import { PracticeAttempt } from './entities/practice-attempt.entity';
import { PracticeTest } from './entities/practice-test.entity';
import { practiceRepository } from './practice.repository';
import { ConfigurePracticeBody, SubmitPracticeBody } from './practice.validation';

const SUBMITTED_LATE = 'submitted_late';

const configure = async (body: ConfigurePracticeBody) => {
  const exam = await examsRepository.findById(body.exam_id);
  if (!exam) throw AppError.notFound('Exam not found');

  // One practice config per exam (1:1), so this is an upsert
  const existing = await practiceRepository.findTestByExam(body.exam_id);
  const saved = await practiceRepository.saveTest({
    ...(existing ?? {}),
    examId: body.exam_id,
    attemptsAllowed: body.attempts_allowed,
    durationMinutes: body.duration_minutes,
    questionCount: body.question_count,
  });
  return { practiceTest: saved, created: !existing };
};

/**
 * Practice papers aren't stored: the question set is derived from the attempt id, so the same
 * set can be rebuilt on submit for scoring.
 */
const questionPool = async (examId: string, manager?: EntityManager) => {
  const categoryIds = await practiceRepository.findCategoryIdsForExam(examId, manager);
  const pool = await questionsRepository.findPoolByCategories(categoryIds, manager);
  const uniqueIds = [...new Set(pool.map((lq) => lq.questionId))].sort();
  if (uniqueIds.length === 0) throw AppError.conflict('No practice questions are available for this exam yet');
  return uniqueIds;
};

const buildPaper = async (test: PracticeTest, attempt: PracticeAttempt, manager?: EntityManager) => {
  const uniqueIds = await questionPool(test.examId, manager);

  const chosen = seededShuffle(uniqueIds, seedFromUuid(attempt.practiceAttemptId)).slice(0, test.questionCount);
  const questions = await questionsRepository.findWithOptionsByIds(chosen, manager);
  return chosen.map((id) => questions.find((q) => q.questionId === id)!);
};

const deadlineOf = (test: PracticeTest, attempt: PracticeAttempt) =>
  new Date(attempt.startedAt.getTime() + test.durationMinutes * 60_000);

const start = async (practiceTestId: string, studentId: string) => {
  const test = await practiceRepository.findTestById(practiceTestId);
  if (!test || !test.exam.isPublished) throw AppError.notFound('Practice test not found');

  if (!(await registrationsRepository.findConfirmed(studentId, test.examId))) {
    throw AppError.forbidden('A confirmed registration for this exam is required for practice');
  }
  // Fail before consuming an attempt if there is nothing to practise
  await questionPool(test.examId);

  const { attempt, resumed } = await transaction(async (manager) => {
    const open = await practiceRepository.findInProgress(practiceTestId, studentId, manager);
    if (open && Date.now() < deadlineOf(test, open).getTime()) return { attempt: open, resumed: true };
    if (open) {
      // Timed out without a submit: close it with no score
      open.status = 'expired';
      await practiceRepository.saveAttempt(open, manager);
    }

    const used = await practiceRepository.countAttempts(practiceTestId, studentId, manager);
    if (used >= test.attemptsAllowed) throw AppError.conflict(`All ${test.attemptsAllowed} practice attempt(s) have been used`);

    const created = await practiceRepository.createAttempt(
      { practiceTestId, studentId, startedAt: new Date(), status: ATTEMPT_STATUS.IN_PROGRESS, score: null, submittedAt: null },
      manager,
    );
    return { attempt: created, resumed: false };
  });

  const questions = await buildPaper(test, attempt);
  return {
    resumed,
    attempt,
    endsAt: deadlineOf(test, attempt),
    questions: questions.map((q, index) => ({
      questionOrder: index + 1,
      questionId: q.questionId,
      questionText: q.questionText,
      options: seededShuffle(
        [...q.options].sort((a, b) => a.optionId.localeCompare(b.optionId)),
        seedFromUuid(attempt.practiceAttemptId) + index,
      ).map((o) => ({ optionId: o.optionId, optionText: o.optionText })),
    })),
  };
};

const submit = async (practiceAttemptId: string, studentId: string, body: SubmitPracticeBody) =>
  transaction(async (manager) => {
    const attempt = await practiceRepository.findAttemptForUpdate(practiceAttemptId, manager);
    if (!attempt || attempt.studentId !== studentId) throw AppError.notFound('Practice attempt not found');
    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) throw AppError.conflict('Practice attempt is already closed');

    const test = (await practiceRepository.findTestById(attempt.practiceTestId, manager))!;
    const questions = await buildPaper(test, attempt, manager);
    const answers = new Map(body.answers.map((a) => [a.question_id, a.selected_option_id]));

    let correct = 0;
    let wrong = 0;
    const review = questions.map((q) => {
      const selected = answers.get(q.questionId) ?? null;
      const correctOption = q.options.find((o) => o.isCorrect);
      const isCorrect = !!selected && selected === correctOption?.optionId;
      if (isCorrect) correct++;
      else if (selected) wrong++;
      return {
        questionId: q.questionId,
        questionText: q.questionText,
        selectedOptionId: selected,
        correctOptionId: correctOption?.optionId ?? null,
        isCorrect,
        explanation: q.explanation,
      };
    });

    // Practice is low-stakes: late submissions are still scored but marked
    const late = Date.now() > deadlineOf(test, attempt).getTime();
    attempt.submittedAt = new Date();
    attempt.score = correct;
    attempt.status = late ? SUBMITTED_LATE : ATTEMPT_STATUS.SUBMITTED;
    await practiceRepository.saveAttempt(attempt, manager);

    return {
      attempt,
      summary: { total: questions.length, correct, wrong, unattempted: questions.length - correct - wrong },
      review,
    };
  });

export const practiceService = { configure, start, submit };
