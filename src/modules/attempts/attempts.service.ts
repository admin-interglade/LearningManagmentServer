import { EntityManager } from 'typeorm';
import { AppError } from '../../common/errors/app-error';
import { ROLES } from '../../common/constants/roles';
import { ATTEMPT_STATUS } from '../../common/constants/statuses';
import { AuthUser } from '../../common/middlewares/auth.middleware';
import { isUniqueViolation, transaction } from '../../common/utils/db';
import { randomSeed } from '../../common/utils/seeded-random';
import { examsRepository } from '../exams/exams.repository';
import { registrationsRepository } from '../registrations/registrations.repository';
import { resultsRepository } from '../results/results.repository';
import { resultsService } from '../results/results.service';
import { notificationsService } from '../notifications/notifications.service';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { attemptsRepository } from './attempts.repository';
import { generatePaper, orderOptions } from './paper-generator';
import { SaveAnswerBody, StartAttemptBody, SubmitAttemptBody } from './attempts.validation';

// Network latency allowance for the final submit when the client timer hits zero
const SUBMIT_GRACE_MS = 30_000;

type AttemptWithContext = ExamAttempt & { registration: NonNullable<ExamAttempt['registration']> };

const deadlineOf = (attempt: AttemptWithContext) =>
  new Date(
    Math.min(
      attempt.startedAt.getTime() + attempt.level.durationMinutes * 60_000,
      attempt.level.exam.examEnd.getTime(),
    ),
  );

const isExpired = (attempt: AttemptWithContext, graceMs = 0) => Date.now() > deadlineOf(attempt).getTime() + graceMs;

const loadOwnAttempt = async (attemptId: string, user: AuthUser, manager?: EntityManager) => {
  const attempt = (await attemptsRepository.findWithContext(attemptId, manager)) as AttemptWithContext | null;
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (user.role !== ROLES.ADMIN && attempt.registration.studentId !== user.userId) {
    throw AppError.notFound('Attempt not found');
  }
  return attempt;
};

/** Locks the attempt row, scores it and records the result. Safe to call twice: returns the existing result. */
const finalize = async (attemptId: string, autoSubmitted: boolean, manager: EntityManager) => {
  const locked = await attemptsRepository.findById(attemptId, manager, 'pessimistic_write');
  if (!locked) throw AppError.notFound('Attempt not found');
  if (locked.status === ATTEMPT_STATUS.SUBMITTED) {
    return { result: await resultsRepository.findByAttempt(attemptId, manager), alreadySubmitted: true };
  }
  const context = (await attemptsRepository.findWithContext(attemptId, manager)) as AttemptWithContext;
  const result = await resultsService.finalizeAttempt(
    locked,
    { studentId: context.registration.studentId, examId: context.level.examId, autoSubmitted },
    manager,
  );
  return { result, alreadySubmitted: false, context };
};

const notifyResult = (studentId: string, attempt: AttemptWithContext, score: number | undefined) =>
  notificationsService.notifySafely({
    userId: studentId,
    eventType: 'RESULT_PUBLISHED',
    payload: { exam_name: attempt.level.exam.name, level_name: attempt.level.name, score },
  });

// Called on every read/write of an attempt: a timed-out attempt is auto-submitted before rejecting the request
const assertOpen = async (attempt: AttemptWithContext) => {
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) throw AppError.conflict('Attempt has already been submitted');
  if (isExpired(attempt, SUBMIT_GRACE_MS)) {
    const { result, alreadySubmitted } = await transaction((m) => finalize(attempt.attemptId, true, m));
    if (!alreadySubmitted) notifyResult(attempt.registration.studentId, attempt, result?.score);
    throw new AppError(409, 'Time is over; the attempt was auto-submitted', { result_id: result?.resultId });
  }
};

const start = async (examId: string, studentId: string, body: StartAttemptBody) => {
  const exam = await examsRepository.findById(examId);
  if (!exam || !exam.isPublished) throw AppError.notFound('Exam not found');

  const level = await examsRepository.findLevelById(body.level_id);
  if (!level || level.examId !== examId) throw AppError.notFound('Level not found for this exam');

  const registration = await registrationsRepository.findConfirmed(studentId, examId);
  if (!registration) throw AppError.forbidden('A confirmed (paid) registration is required to take this exam');

  const now = new Date();
  if (now < exam.examStart || now > exam.examEnd) throw AppError.badRequest('The exam is not live right now');

  // Resume an unfinished attempt instead of burning another one
  const inProgress = await attemptsRepository.findInProgress(registration.registrationId, level.levelId);
  if (inProgress) {
    const context = (await attemptsRepository.findWithContext(inProgress.attemptId)) as AttemptWithContext;
    if (!isExpired(context, SUBMIT_GRACE_MS)) {
      return { attempt: inProgress, resumed: true, endsAt: deadlineOf(context) };
    }
    const { result, alreadySubmitted } = await transaction((m) => finalize(inProgress.attemptId, true, m));
    if (!alreadySubmitted) notifyResult(studentId, context, result?.score);
  }

  try {
    const attempt = await transaction(async (manager) => {
      const used = await attemptsRepository.countForLevel(registration.registrationId, level.levelId, manager);
      if (used >= level.attemptsAllowed) {
        throw AppError.conflict(`All ${level.attemptsAllowed} attempt(s) for this level have been used`);
      }

      const seed = randomSeed();
      const questionIds = await generatePaper(level.levelId, level.questionCount, seed, manager);

      const created = await attemptsRepository.create(
        {
          registrationId: registration.registrationId,
          levelId: level.levelId,
          attemptNumber: used + 1,
          generationSeed: String(seed),
          startedAt: new Date(),
          status: ATTEMPT_STATUS.IN_PROGRESS,
          autoSubmitted: false,
        },
        manager,
      );
      await attemptsRepository.createQuestions(
        questionIds.map((questionId, index) => ({
          attemptId: created.attemptId,
          questionId,
          questionOrder: index + 1,
          isSkipped: false,
          isFlagged: false,
        })),
        manager,
      );
      return created;
    });

    const endsAt = new Date(Math.min(attempt.startedAt.getTime() + level.durationMinutes * 60_000, exam.examEnd.getTime()));
    return { attempt, resumed: false, endsAt };
  } catch (err) {
    // Two parallel "start" clicks race on (registration, level, attempt_number)
    if (isUniqueViolation(err)) throw AppError.conflict('An attempt is already being started; retry in a moment');
    throw err;
  }
};

const getQuestions = async (attemptId: string, user: AuthUser) => {
  const attempt = await loadOwnAttempt(attemptId, user);
  await assertOpen(attempt);

  const seed = Number(attempt.generationSeed);
  const rows = await attemptsRepository.findQuestions(attemptId);
  const endsAt = deadlineOf(attempt);

  return {
    attemptId,
    level: { levelId: attempt.levelId, name: attempt.level.name, durationMinutes: attempt.level.durationMinutes },
    status: attempt.status,
    startedAt: attempt.startedAt,
    endsAt,
    remainingSeconds: Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000)),
    summary: {
      total: rows.length,
      answered: rows.filter((r) => r.selectedOptionId).length,
      skipped: rows.filter((r) => r.isSkipped).length,
      flagged: rows.filter((r) => r.isFlagged).length,
    },
    // Correct answers are never sent while the attempt is running
    questions: rows.map((row) => ({
      attemptQuestionId: row.attemptQuestionId,
      questionOrder: row.questionOrder,
      questionText: row.question.questionText,
      options: orderOptions(row.question.options, seed, row.questionOrder).map((o) => ({
        optionId: o.optionId,
        optionText: o.optionText,
      })),
      selectedOptionId: row.selectedOptionId,
      isSkipped: row.isSkipped,
      isFlagged: row.isFlagged,
      answeredAt: row.answeredAt,
    })),
  };
};

const saveAnswer = async (attemptId: string, attemptQuestionId: string, user: AuthUser, body: SaveAnswerBody) => {
  const attempt = await loadOwnAttempt(attemptId, user);
  await assertOpen(attempt);

  return transaction(async (manager) => {
    // Shared lock: answers can't be written while a submit (exclusive lock) is scoring the attempt
    const locked = await attemptsRepository.findById(attemptId, manager, 'pessimistic_read');
    if (!locked || locked.status !== ATTEMPT_STATUS.IN_PROGRESS) throw AppError.conflict('Attempt has already been submitted');

    const row = await attemptsRepository.findQuestion(attemptId, attemptQuestionId, manager);
    if (!row) throw AppError.notFound('Question not found in this attempt');

    if (body.selected_option_id !== undefined) {
      if (body.selected_option_id && !row.question.options.some((o) => o.optionId === body.selected_option_id)) {
        throw AppError.badRequest('selected_option_id does not belong to this question');
      }
      row.selectedOptionId = body.selected_option_id;
      row.answeredAt = body.selected_option_id ? new Date() : null;
      if (body.selected_option_id) row.isSkipped = false;
    }
    if (body.is_skipped !== undefined) {
      row.isSkipped = body.is_skipped;
      if (body.is_skipped) {
        row.selectedOptionId = null;
        row.answeredAt = null;
      }
    }
    if (body.is_flagged !== undefined) row.isFlagged = body.is_flagged;

    const { question: _q, ...saved } = await attemptsRepository.saveQuestion(row, manager);
    return saved;
  });
};

const submit = async (attemptId: string, user: AuthUser, body: SubmitAttemptBody) => {
  const attempt = await loadOwnAttempt(attemptId, user);
  if (user.role !== ROLES.STUDENT) throw AppError.forbidden('Only the student can submit an attempt');

  const timedOut = isExpired(attempt);
  // Answers sent after the deadline (+ grace) are ignored; whatever was saved in time is scored
  const acceptAnswers = !isExpired(attempt, SUBMIT_GRACE_MS);

  const outcome = await transaction(async (manager) => {
    const locked = await attemptsRepository.findById(attemptId, manager, 'pessimistic_write');
    if (locked?.status === ATTEMPT_STATUS.IN_PROGRESS && acceptAnswers && body.answers.length) {
      const ids = body.answers.map((a) => a.attempt_question_id);
      const rows = await attemptsRepository.findQuestionsByIds(attemptId, ids, manager);
      if (rows.length !== new Set(ids).size) throw AppError.badRequest('Some attempt_question_id values do not belong to this attempt');

      for (const answer of body.answers) {
        const row = rows.find((r) => r.attemptQuestionId === answer.attempt_question_id)!;
        if (answer.selected_option_id && !row.question.options.some((o) => o.optionId === answer.selected_option_id)) {
          throw AppError.badRequest(`Option ${answer.selected_option_id} does not belong to its question`);
        }
        row.selectedOptionId = answer.selected_option_id;
        row.answeredAt = answer.selected_option_id ? new Date() : null;
        if (answer.selected_option_id) row.isSkipped = false;
      }
      await attemptsRepository.saveQuestions(
        rows.map(({ question: _q, ...r }) => r as typeof rows[number]),
        manager,
      );
    }
    return finalize(attemptId, body.auto_submit || timedOut, manager);
  });

  if (!outcome.alreadySubmitted) notifyResult(attempt.registration.studentId, attempt, outcome.result?.score);
  return { result: outcome.result, alreadySubmitted: outcome.alreadySubmitted };
};

const getResult = async (attemptId: string, user: AuthUser) => {
  const attempt = await loadOwnAttempt(attemptId, user);
  if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
    await assertOpen(attempt); // auto-submits and throws if the timer ran out
    throw AppError.conflict('Attempt is still in progress');
  }

  const result = await resultsRepository.findByAttempt(attemptId);
  if (!result) throw AppError.notFound('Result not found');

  const exam = attempt.level.exam;
  // The answer key stays hidden until the exam window closes, so it can't leak to students still writing
  const reviewAvailable = user.role === ROLES.ADMIN || Date.now() > exam.examEnd.getTime();
  const rows = await attemptsRepository.findQuestions(attemptId);

  return {
    result,
    attempt: {
      attemptId,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
    },
    exam: { examId: exam.examId, name: exam.name },
    level: { levelId: attempt.levelId, name: attempt.level.name, maxScore: attempt.level.maxScore },
    summary: {
      total: rows.length,
      correct: rows.filter((r) => r.question.options.some((o) => o.optionId === r.selectedOptionId && o.isCorrect)).length,
      unattempted: result.unattemptedCount,
    },
    reviewAvailable,
    review: reviewAvailable
      ? rows.map((r) => ({
          questionOrder: r.questionOrder,
          questionText: r.question.questionText,
          selectedOptionId: r.selectedOptionId,
          correctOptionId: r.question.options.find((o) => o.isCorrect)?.optionId ?? null,
          isCorrect: r.question.options.some((o) => o.optionId === r.selectedOptionId && o.isCorrect),
          explanation: r.question.explanation,
          options: r.question.options.map((o) => ({ optionId: o.optionId, optionText: o.optionText })),
        }))
      : [],
  };
};

export const attemptsService = { start, getQuestions, saveAnswer, submit, getResult };
