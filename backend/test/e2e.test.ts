/**
 * End-to-end API test. Requires a migrated + seeded database:
 *   DATABASE_URL=postgres://.../interglade_test npm run db:seed && DATABASE_URL=... npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { createApp } from '../src/app';
import { pool } from '../src/db/pool';
import { verifyPaymentSignature } from '../src/modules/payments/razorpay.client';

let server: Server;
let base = '';

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json as any };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  server = createApp().listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
after(async () => { server.close(); await pool.end(); });

const uniq = crypto.randomBytes(3).toString('hex');
const email = `student.${uniq}@example.com`;
const digits = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
const phone = `+91 ${digits}`;
let adminToken = '';
let studentToken = '';
let studentId = '';

test('admin and student auth flows', async () => {
  const admin = await api('POST', '/auth/login', { identifier: 'admin@interglade.com', password: 'Admin@12345' });
  assert.equal(admin.status, 200);
  adminToken = admin.body.token;

  const bad = await api('POST', '/auth/register', { name: 'X', password: 'short', dob: '2012-01-01' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.details.password, 'per-field details');
  assert.ok(bad.body.error.details.name);
  assert.ok(bad.body.error.details.email, 'email or phone is required');

  const reg = await api('POST', '/auth/register', {
    name: 'Asha Kumar', email, phone, password: 'Secret123', dob: '2013-05-10', gender: 'female', school: 'Delhi Public School',
    grade: '7', city: 'Pune', state: 'Maharashtra', guardianName: 'R. Kumar', guardianPhone: '+91 9876500000',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.equal(reg.body.user.role, 'student');
  assert.equal(reg.body.user.name, 'Asha Kumar');
  assert.equal(reg.body.user.phone, phone, 'phone stored as sent');
  assert.equal(reg.body.user.dob, '2013-05-10');
  assert.equal(reg.body.user.guardianPhone, '+91 9876500000');
  assert.equal(reg.body.user.password, undefined);
  studentId = reg.body.user.id;

  const dup = await api('POST', '/auth/register', { name: 'Dup', phone: digits, password: 'Secret123', dob: '2013-05-10' });
  assert.equal(dup.status, 409, 'same phone without country code is a duplicate');

  const byPhone = await api('POST', '/auth/login', { identifier: digits, password: 'Secret123' });
  assert.equal(byPhone.status, 200);
  const wrong = await api('POST', '/auth/login', { identifier: email, password: 'Wrong1234' });
  assert.equal(wrong.status, 401);

  const forgot = await api('POST', '/auth/forgot-password', { identifier: email });
  assert.ok(forgot.body.devResetToken);
  const reset = await api('POST', '/auth/reset-password', { identifier: email, token: forgot.body.devResetToken, password: 'NewSecret123' });
  assert.equal(reset.status, 200);
  const reused = await api('POST', '/auth/reset-password', { token: forgot.body.devResetToken, password: 'Another123' });
  assert.equal(reused.status, 400);

  const login = await api('POST', '/auth/login', { identifier: email, password: 'NewSecret123' });
  assert.equal(login.status, 200);
  studentToken = login.body.token;

  const change = await api('POST', '/auth/change-password', { currentPassword: 'NewSecret123', newPassword: 'Secret123' }, studentToken);
  assert.equal(change.status, 200);

  const profile = await api('PUT', '/profile', { name: 'Asha K', email, phone, dob: '2013-05-10', city: 'Pune', school: 'DPS' }, studentToken);
  assert.equal(profile.body.user.city, 'Pune');
  assert.equal(profile.body.user.guardianName, null, 'PUT is a full replace');

  const forbidden = await api('GET', '/admin/dashboard/summary', undefined, studentToken);
  assert.equal(forbidden.status, 403);
});

test('student registers, pays, books slots, practices and takes the real exam', async () => {
  const exams = await api('GET', '/public/exams');
  const olympiad = exams.body.find((e: any) => e.title.includes('Maths Olympiad'));
  assert.ok(olympiad);
  assert.equal(olympiad.phase, 'In Progress');
  assert.ok(exams.body.some((e: any) => e.phase === 'Completed'), 'completed exams are listed');
  assert.equal(olympiad.levels[0].sections.length, 2);
  assert.equal(olympiad.levels[0].sections[0].complexity, 'Low');

  const stats = await api('GET', '/public/stats');
  assert.equal(stats.body.topAward, 10000);
  assert.ok(stats.body.subjects >= 3);

  const price = await api('POST', '/student/discounts/validate', { examId: olympiad.id, code: 'early20' }, studentToken);
  assert.deepEqual(
    { gross: price.body.gross, discount: price.body.discount, taxable: price.body.taxable, tax: price.body.tax, total: price.body.total },
    { gross: 499, discount: 99.8, taxable: 399.2, tax: 71.86, total: 471.06 },
  );
  const badCode = await api('POST', '/student/discounts/validate', { examId: olympiad.id, code: 'NOPE' }, studentToken);
  assert.equal(badCode.status, 400);
  assert.ok(badCode.body.error.details.code);

  const created = await api('POST', '/student/registrations', { examId: olympiad.id, discountCode: 'EARLY20' }, studentToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.order.provider, 'mock');
  assert.equal(created.body.order.amount, 47106);
  assert.equal(created.body.registration.payment.status, 'pending');
  const regId = created.body.registration.id;

  const early = await api('POST', '/attempts', { registrationId: regId, levelId: olympiad.levels[0].id, mode: 'practice' }, studentToken);
  assert.equal(early.status, 400, 'cannot attempt before payment');

  const paid = await api('POST', '/payments/mock-complete', { registrationId: regId }, studentToken);
  assert.equal(paid.body.status, 'active');
  assert.equal(paid.body.payment.status, 'paid');
  assert.equal(paid.body.payment.amount, 471.06);
  assert.equal(paid.body.payment.discountCode, 'EARLY20');

  const again = await api('POST', '/student/registrations', { examId: olympiad.id }, studentToken);
  assert.equal(again.status, 409);

  let detail = await api('GET', `/student/registrations/${regId}`, undefined, studentToken);
  assert.equal(detail.body.canAttemptRealNow, false);
  assert.equal(detail.body.realBlockReason, 'Book a slot for this level');
  assert.equal(detail.body.levels[1].lockReason, 'Clear Level 1 to unlock this level');

  const level1 = olympiad.levels[0];
  const slot1 = olympiad.slots.find((s: any) => s.levelId === level1.id);
  const wrongLevel = await api('PUT', `/student/registrations/${regId}/slot`, { levelId: olympiad.levels[1].id, slotId: slot1.id }, studentToken);
  assert.equal(wrongLevel.status, 400);
  const booked = await api('PUT', `/student/registrations/${regId}/slot`, { levelId: level1.id, slotId: slot1.id }, studentToken);
  assert.equal(booked.body.slotByLevel[level1.id], slot1.id);

  detail = await api('GET', `/student/registrations/${regId}`, undefined, studentToken);
  assert.equal(detail.body.canAttemptRealNow, true, detail.body.realBlockReason);
  assert.equal(detail.body.levels[1].unlocked, false);
  assert.equal(detail.body.practiceAttemptsLeft, 3);

  // Practice: sampled proportionally (10 questions from a 10 + 5 level), answers hidden until submitted.
  const practice = await api('POST', '/attempts', { registrationId: regId, levelId: level1.id, mode: 'practice' }, studentToken);
  assert.equal(practice.status, 201);
  assert.equal(practice.body.questions.length, olympiad.practiceQuestionCount);
  assert.equal(practice.body.questions[0].correctIndex, undefined, 'answers hidden during attempt');
  assert.equal(practice.body.questions[0].explanation, undefined);
  assert.equal(practice.body.questions[0].category, 'Mathematics');
  assert.ok(practice.body.remainingSeconds > 0);
  const resumed = await api('POST', '/attempts', { registrationId: regId, levelId: level1.id, mode: 'practice' }, studentToken);
  assert.equal(resumed.body.id, practice.body.id, 'resumes open attempt');
  const refreshed = await api('GET', `/attempts/${practice.body.id}`, undefined, studentToken);
  assert.equal(refreshed.body.questions[0].correctIndex, undefined);
  await api('PUT', `/attempts/${practice.body.id}/answers`, { position: 3, selectedIndex: 1 }, studentToken);
  const saved = await api('PUT', `/attempts/${practice.body.id}/answers`, { position: 1, selectedIndex: 0 }, studentToken);
  assert.equal(saved.body.ok, true);
  assert.ok(saved.body.remainingSeconds > 0);
  await api('PUT', `/attempts/${practice.body.id}/answers`, { position: 3, selectedIndex: null }, studentToken);
  const pr = await api('POST', `/attempts/${practice.body.id}/submit`, undefined, studentToken);
  assert.equal(pr.body.status, 'submitted');
  assert.equal(pr.body.result.unanswered, olympiad.practiceQuestionCount - 1);
  assert.equal(typeof pr.body.questions[0].correctIndex, 'number');
  const again2 = await api('POST', `/attempts/${practice.body.id}/submit`, undefined, studentToken);
  assert.equal(again2.body.result.score, pr.body.result.score, 'submit is idempotent');

  // Real attempt: answer everything correctly (read keys from DB) to unlock level 2.
  const real = await api('POST', '/attempts', { registrationId: regId, levelId: level1.id, mode: 'real' }, studentToken);
  assert.equal(real.status, 201, JSON.stringify(real.body));
  assert.equal(real.body.questions.length, 15);
  const keys = await pool.query('SELECT position, correct_index FROM attempt_questions WHERE attempt_id = $1', [real.body.id]);
  for (const k of keys.rows) {
    const r = await api('PUT', `/attempts/${real.body.id}/answers`, { position: k.position, selectedIndex: k.correct_index }, studentToken);
    assert.equal(r.status, 200);
  }
  const rr = await api('POST', `/attempts/${real.body.id}/submit`, undefined, studentToken);
  assert.equal(rr.body.result.score, level1.maxScore);
  assert.equal(rr.body.result.percentage, 100);
  assert.equal(rr.body.result.passed, true);
  const late = await api('PUT', `/attempts/${real.body.id}/answers`, { position: 1, selectedIndex: 0 }, studentToken);
  assert.equal(late.status, 409);

  detail = await api('GET', `/student/registrations/${regId}`, undefined, studentToken);
  assert.equal(detail.body.levels[0].bestScore, level1.maxScore);
  assert.equal(detail.body.levels[0].realAttemptsLeft, level1.attempts - 1);
  assert.equal(detail.body.levels[1].unlocked, true);
  assert.equal(detail.body.realBlockReason, 'Book a slot for this level', 'level 2 needs its own slot');
  assert.ok(detail.body.myRank.rank >= 1);

  const board = await api('GET', `/student/exams/${olympiad.id}/leaderboard`, undefined, studentToken);
  assert.ok(board.body.me);
  assert.equal(board.body.me.perLevel[level1.id], level1.maxScore);
  assert.equal(board.body.exam.phase, 'In Progress');

  const dash = await api('GET', '/student/dashboard', undefined, studentToken);
  assert.equal(dash.body.stats.registered, 1);
  assert.equal(dash.body.stats.inProgress, 1);
  assert.equal(dash.body.stats.sat, 1);
  assert.equal(dash.body.stats.practiceTaken, 1);
  assert.equal(dash.body.stats.averageScorePercent, 100);

  const receipts = await api('GET', '/student/payments', undefined, studentToken);
  assert.equal(receipts.body[0].examTitle, olympiad.title);

  // Level 3 still locked for real attempts.
  const locked = await api('POST', '/attempts', { registrationId: regId, levelId: olympiad.levels[2].id, mode: 'real' }, studentToken);
  assert.equal(locked.status, 400);
  assert.equal(locked.body.error.message, 'Clear Level 2 to unlock this level');
});

test('an expired attempt is auto-submitted when touched', async () => {
  const [row] = (await pool.query(
    `SELECT a.id FROM attempts a WHERE a.user_id = $1 AND a.mode = 'practice' LIMIT 1`, [studentId])).rows;
  const regs = await api('GET', '/student/registrations', undefined, studentToken);
  const reg = regs.body[0];
  const started = await api('POST', '/attempts', { registrationId: reg.id, levelId: reg.exam.levels[1].id, mode: 'practice' }, studentToken);
  assert.equal(started.status, 201);
  assert.notEqual(started.body.id, row.id);
  await pool.query(`UPDATE attempts SET expires_at = now() - interval '1 minute' WHERE id = $1`, [started.body.id]);
  const res = await api('PUT', `/attempts/${started.body.id}/answers`, { position: 1, selectedIndex: 0 }, studentToken);
  assert.equal(res.status, 409);
  const after = await api('GET', `/attempts/${started.body.id}`, undefined, studentToken);
  assert.equal(after.body.status, 'submitted', 'auto-submit is committed');
});

test('age group is enforced at registration', async () => {
  const young = await api('POST', '/auth/register', { name: 'Tiny', email: `tiny.${uniq}@example.com`, password: 'Secret123', dob: '2022-01-01' });
  const exams = await api('GET', '/public/exams');
  const olympiad = exams.body.find((e: any) => e.title.includes('Maths Olympiad'));
  const res = await api('POST', '/student/registrations', { examId: olympiad.id }, young.body.token);
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /ages/);
  // Open-to-all exams skip the check.
  const open = exams.body.find((e: any) => e.ageGroupMin === null && e.registrationOpen);
  const ok = await api('POST', '/student/registrations', { examId: open.id }, young.body.token);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test('admin manages exams, slots, discounts, questions, payments and sees dashboard', async () => {
  const summary = await api('GET', '/admin/dashboard/summary', undefined, adminToken);
  assert.ok(summary.body.totalStudents >= 1);
  assert.ok(summary.body.exams.inProgress >= 1);
  assert.ok(summary.body.papersSubmitted >= 1);
  assert.ok(summary.body.revenueByPhase['In Progress'] > 0);

  const inProgress = await api('GET', '/admin/dashboard/exams?status=in_progress', undefined, adminToken);
  assert.ok(inProgress.body[0].topStudents.length >= 1);
  assert.ok(inProgress.body[0].revenue > 0);
  assert.ok(inProgress.body[0].slotCapacity > 0);
  const future = await api('GET', '/admin/dashboard/exams?status=future', undefined, adminToken);
  assert.deepEqual(future.body[0].topStudents, []);

  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  const input = {
    title: `Test Exam ${uniq}`, description: 'Test', award: 'Trophy', ageGroupMin: null, ageGroupMax: null,
    registrationStart: d(-1), registrationEnd: d(5), examStart: d(6), examEnd: d(8),
    durationMinutes: 30, registrationFee: 0, practiceAttempts: 2, practiceQuestionCount: 4,
    levels: [
      { order: 1, name: 'L1', attempts: 3, durationMinutes: 20, passPercent: 50,
        sections: [{ category: 'Mathematics', complexity: 'Low', questionCount: 5, marksPerQuestion: 2 }] },
      { id: 'draft-1', order: 2, name: 'L2', attempts: 1, passPercent: 0,
        sections: [
          { category: 'General Knowledge', complexity: 'High', questionCount: 3, marksPerQuestion: 1 },
          { category: 'Logical Reasoning', complexity: 'Medium', questionCount: 2, marksPerQuestion: 1 },
        ] },
    ],
  };
  const badDates = await api('POST', '/admin/exams', { ...input, examEnd: d(1) }, adminToken);
  assert.equal(badDates.status, 400);
  assert.ok(badDates.body.error.details.examEnd);
  const badSection = await api('POST', '/admin/exams', { ...input, levels: [{ ...input.levels[0], sections: [{ category: 'Astrology', complexity: 'Low', questionCount: 0 }] }] }, adminToken);
  assert.equal(badSection.status, 400);
  assert.ok(badSection.body.error.details['levels.0.sections.0.questionCount']);
  const created = await api('POST', '/admin/exams', input, adminToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.phase, 'Draft');
  assert.equal(created.body.published, false);
  assert.equal(created.body.levels[1].durationMinutes, 30, 'level duration defaults to the exam');
  assert.equal(created.body.levels[1].sections.length, 2);

  // Reorder levels, edit a section, keep ids.
  const [l1, l2] = created.body.levels;
  const updated = await api('PUT', `/admin/exams/${created.body.id}`, {
    ...input,
    levels: [
      { ...input.levels[1], id: l2.id, order: 1, sections: l2.sections.map((s: any) => ({ ...s })) },
      { ...input.levels[0], id: l1.id, order: 2, sections: [{ ...l1.sections[0], questionCount: 8 }] },
    ],
  }, adminToken);
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.levels[0].id, l2.id);
  assert.equal(updated.body.levels[1].sections[0].id, l1.sections[0].id);
  assert.equal(updated.body.levels[1].sections[0].questionCount, 8);

  const outside = await api('POST', `/admin/exams/${created.body.id}/slots`, { levelId: l1.id, startsAt: d(1), capacity: 5 }, adminToken);
  assert.equal(outside.status, 400);
  const slot = await api('POST', `/admin/exams/${created.body.id}/slots`, { levelId: l1.id, startsAt: d(6), capacity: 1 }, adminToken);
  assert.equal(slot.status, 201, JSON.stringify(slot.body));
  assert.equal(slot.body.levelId, l1.id);
  assert.equal(slot.body.bookedCount, 0);

  const pub = await api('POST', `/admin/exams/${created.body.id}/publish`, { isPublished: true }, adminToken);
  assert.equal(pub.body.phase, 'Future');
  const home = await api('GET', '/public/exams');
  assert.ok(home.body.some((e: any) => e.id === created.body.id));

  // Free exam registers instantly; slot capacity 1 is enforced.
  const s2 = await api('POST', '/auth/register', { name: 'Ravi', phone: `+91 97${Math.floor(10_000_000 + Math.random() * 89_999_999)}`, password: 'Secret123', dob: '2012-02-02' });
  const free = await api('POST', '/student/registrations', { examId: created.body.id }, s2.body.token);
  assert.equal(free.status, 201, JSON.stringify(free.body));
  assert.equal(free.body.order, null);
  assert.equal(free.body.registration.payment.status, 'paid');
  await api('PUT', `/student/registrations/${free.body.registration.id}/slot`, { levelId: l1.id, slotId: slot.body.id }, s2.body.token);
  const s1Free = await api('POST', '/student/registrations', { examId: created.body.id }, studentToken);
  const full = await api('PUT', `/student/registrations/${s1Free.body.registration.id}/slot`, { levelId: l1.id, slotId: slot.body.id }, studentToken);
  assert.equal(full.status, 409);
  const shrink = await api('PUT', `/admin/slots/${slot.body.id}`, { levelId: l1.id, startsAt: d(6), capacity: 0 }, adminToken);
  assert.equal(shrink.status, 400);
  assert.equal((await api('DELETE', `/admin/slots/${slot.body.id}`, undefined, adminToken)).status, 409);

  const regs = await api('GET', `/admin/exams/${created.body.id}/registrations`, undefined, adminToken);
  assert.equal(regs.body.length, 2);
  assert.equal(typeof regs.body[0].student.age, 'number');
  const del = await api('DELETE', `/admin/exams/${created.body.id}`, undefined, adminToken);
  assert.equal(del.status, 409);
  const report = await api('GET', `/admin/exams/${created.body.id}/report`, undefined, adminToken);
  assert.equal(report.body.registeredCount, 2);
  assert.equal(report.body.slotsBooked, 1);

  // Discounts
  const disc = await api('POST', '/admin/discounts', { code: `t${uniq}`, label: 'Test', type: 'flat', value: 50, examIds: [created.body.id], validFrom: d(-1), validTo: d(10), maxUses: 1, active: true }, adminToken);
  assert.equal(disc.status, 201, JSON.stringify(disc.body));
  assert.equal(disc.body.code, `T${uniq}`.toUpperCase());
  assert.equal(disc.body.used, 0);
  const dupCode = await api('POST', '/admin/discounts', { code: `t${uniq}`, type: 'flat', value: 5, validFrom: d(-1), validTo: d(10) }, adminToken);
  assert.equal(dupCode.status, 409);
  assert.equal((await api('DELETE', `/admin/discounts/${disc.body.id}`, undefined, adminToken)).status, 200);

  // Question bank
  const cats = await api('GET', '/categories');
  const gk = cats.body.find((c: any) => c.name === 'General Knowledge');
  const maths = cats.body.find((c: any) => c.name === 'Mathematics');
  const q = await api('POST', '/admin/questions', { categoryId: gk.id, complexity: 'Low', text: 'Sky colour?', options: ['Blue', 'Red', 'Green', 'Pink'], correctIndex: 0 }, adminToken);
  assert.equal(q.status, 201);
  assert.equal(q.body.complexity, 'Low');
  const list = await api('GET', `/admin/questions?categoryId=${gk.id}&complexity=Low&pageSize=5`, undefined, adminToken);
  assert.ok(list.body.total >= 7);
  const preview = await api('POST', '/admin/questions/preview', { categoryId: maths.id, complexity: 'High', count: 5 }, adminToken);
  assert.equal(preview.body.length, 5);
  await api('DELETE', `/admin/questions/${q.body.id}`, undefined, adminToken);

  // Payment settings
  const base = { provider: 'Razorpay', currency: 'INR', merchantName: 'Interglade Talent', merchantEmail: 'payments@interglade.com', gstPercent: 18, testMode: true, enabled: true };
  const badKey = await api('PUT', '/admin/settings/payment', { ...base, keyId: 'rzp_live_x', keySecret: 's' }, adminToken);
  assert.equal(badKey.status, 400);
  assert.ok(badKey.body.error.details.keyId);
  const saved = await api('PUT', '/admin/settings/payment', base, adminToken);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const settings = await api('GET', '/admin/settings/payment', undefined, adminToken);
  assert.equal(settings.body.hasKeySecret, false);
  assert.equal(settings.body.keySecret, undefined);
  assert.equal(settings.body.gstPercent, 18);
  const config = await api('GET', '/payments/config');
  assert.equal(config.body.provider, 'mock');
  assert.equal(config.body.gstPercent, 18);

  // Payments ledger: totals cover the filtered set.
  const ledger = await api('GET', `/admin/payments?search=${uniq}&pageSize=1`, undefined, adminToken);
  assert.ok(ledger.body.total >= 1);
  assert.ok(ledger.body.items.length <= 1);
  assert.ok(ledger.body.totals.net >= 471.06);

  const students = await api('GET', `/admin/students?search=${uniq}`, undefined, adminToken);
  assert.ok(students.body.total >= 1);
  const asha = students.body.items.find((s: any) => s.id === studentId);
  assert.equal(asha.papersSubmitted, 1);
  assert.equal(asha.totalPaid, 471.06);
  const detail = await api('GET', `/admin/students/${studentId}`, undefined, adminToken);
  assert.equal(detail.body.papers.length, 3);

  const patched = await api('PATCH', `/admin/students/${studentId}`, { city: 'Mumbai' }, adminToken);
  assert.equal(patched.body.user.city, 'Mumbai');
  assert.equal(patched.body.user.email, email, 'PATCH keeps other fields');
  const clash = await api('PATCH', `/admin/students/${studentId}`, { email: `tiny.${uniq}@example.com` }, adminToken);
  assert.equal(clash.status, 409);
});

test('admin-only routes create admins and students', async () => {
  const adminEmail = `admin.${uniq}@interglade.com`;
  const denied = await api('POST', '/admin/admins', { name: 'Nope', email: adminEmail, password: 'Secret123' }, studentToken);
  assert.equal(denied.status, 403);

  const admin = await api('POST', '/admin/admins', { name: 'Second Admin', email: adminEmail, password: 'Secret123' }, adminToken);
  assert.equal(admin.status, 201, JSON.stringify(admin.body));
  assert.equal(admin.body.user.role, 'admin');
  const login = await api('POST', '/auth/login', { identifier: adminEmail, password: 'Secret123' });
  assert.equal(login.body.user.role, 'admin');
  const admins = await api('GET', '/admin/admins', undefined, adminToken);
  assert.ok(admins.body.some((a: any) => a.email === adminEmail));

  const student = await api('POST', '/admin/students', { name: 'Walk In', email: `walkin.${uniq}@example.com`, password: 'Secret123', dob: '2011-03-03' }, adminToken);
  assert.equal(student.status, 201);
  assert.equal(student.body.user.role, 'student');

  // Public registration can never produce an admin, even if "role" is sent.
  const sneaky = await api('POST', '/auth/register', { name: 'Sneaky', email: `sneaky.${uniq}@example.com`, password: 'Secret123', dob: '2011-03-03', role: 'admin' });
  assert.equal(sneaky.body.user.role, 'student');
});

test('practice papers are sampled in proportion to the level sections', async () => {
  const { allocate } = await import('../src/modules/attempts/attempts.service');
  assert.deepEqual(allocate([{ questionCount: 10 }, { questionCount: 5 }], 10), [7, 3]);
  assert.deepEqual(allocate([{ questionCount: 1 }, { questionCount: 1 }, { questionCount: 1 }], 4).reduce((a, b) => a + b), 4);
});

test('question generators produce valid unique MCQs', async () => {
  const { generateQuestions } = await import('../src/modules/question-bank/generators');
  for (const generator of ['maths', 'reasoning'] as const) {
    for (const cx of ['low', 'medium', 'high'] as const) {
      const qs = await generateQuestions({ id: 'x', name: generator, generator }, cx, 25);
      assert.equal(qs.length, 25);
      assert.equal(new Set(qs.map((q) => q.text)).size, 25, `${generator}/${cx} unique`);
      for (const q of qs) {
        assert.equal(q.options.length, 4, q.text);
        assert.equal(new Set(q.options).size, 4, `distinct options: ${q.text} ${q.options}`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
      }
    }
  }
});

test('razorpay signature verification', () => {
  const sig = crypto.createHmac('sha256', 'secret').update('order_1|pay_1').digest('hex');
  assert.equal(verifyPaymentSignature('order_1', 'pay_1', sig, 'secret'), true);
  assert.equal(verifyPaymentSignature('order_1', 'pay_2', sig, 'secret'), false);
});
