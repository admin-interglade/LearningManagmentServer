# Online Examination API

Node.js + Express 5 + PostgreSQL + TypeORM backend for the Online Examination project (spec: `../Online_Examination_Complete_Project.xlsx`).

## Setup

```bash
cp .env.example .env        # fill in DB credentials, JWT secrets, SEED_ADMIN_PASSWORD
npm install
npm run migration:run       # creates all 20 tables
npm run seed                # creates roles (student, admin) and the first admin user
npm run dev                 # http://localhost:5050/api
```

Production: `npm run build && npm start`.

For local payment testing without Razorpay keys, set `RAZORPAY_MOCK=true` (it is rejected when `NODE_ENV=production`).
With `NOTIFICATION_DRIVER=console`, SMS and email are logged to stdout instead of being sent.

## Project structure

```
src/
  app.ts, server.ts           Express app and bootstrap
  config/                     env loading, TypeORM DataSource
  common/                     errors, middlewares (auth/RBAC, validation, errors), utils, constants
  database/migrations|seeds
  routes/index.ts             mounts every module router under API_PREFIX
  modules/<module>/
    entities/*.entity.ts      TypeORM entities (one per table)
    <module>.routes.ts        routes + middleware (auth, RBAC, zod validation)
    <module>.controller.ts    HTTP layer
    <module>.service.ts       business logic
    <module>.repository.ts    data access
    <module>.validation.ts    zod request schemas
```

Modules: `auth`, `users`, `exams`, `questions`, `practice`, `registrations`, `discounts`, `payments`, `attempts`, `results`, `students`, `admin`, `notifications`.
Every `/api/admin/*` route is mounted in `admin/admin.routes.ts` behind an admin-only guard. The handlers live in their own modules, for example exam CRUD in `exams`.

## Conventions

- Requests and responses use snake_case, matching the DB schema. Responses look like `{ success, message, data }`.
- Auth: `Authorization: Bearer <access_token>` from `/auth/login` or `/auth/register`.
- Roles: `student` handles registrations, payments, attempts, practice and the student dashboard. `admin` handles `/admin/*` and `/notifications/*`. Exam list, detail and leaderboard are open to any authenticated user.

## Endpoints

| Method | Endpoint | Role |
|---|---|---|
| POST | /api/auth/register, /login, /forgot-password, /reset-password | public |
| POST | /api/auth/change-password | any |
| GET | /api/exams, /api/exams/{examId}, /api/exams/{examId}/leaderboard | any |
| POST | /api/exams/{examId}/attempts | student |
| GET/PUT/POST | /api/attempts/{attemptId}/questions, /questions/{attemptQuestionId}, /submit | student |
| GET | /api/attempts/{attemptId}/result | student (own) / admin |
| POST | /api/registrations | student |
| POST | /api/payments/razorpay/order, /api/payments/razorpay/verify | student |
| POST | /api/practice-tests/{id}/attempts, /api/practice-attempts/{id}/submit | student |
| GET | /api/students/dashboard | student |
| * | /api/admin/... (exams, levels, categories, questions, practice-tests, discounts, dashboard, reports) | admin |
| POST | /api/notifications/events, /api/notifications/{id}/retry | admin |

## Business rules beyond the spec sheet

- **Question bank to blueprint:** `POST/PUT /admin/questions` accept `level_categories: [{ level_category_id, weightage }]`, which fills `level_questions`. A question's complexity must match its category's complexity. Each question has exactly one correct option.
- **Paper generation:** each attempt stores a random `generation_seed`. Questions are drawn round-robin across the level's categories using that seed, and the option order comes from the same seed. The server never sends `is_correct` while an attempt is running.
- **Timing:** the deadline is `min(started_at + duration, exam_end)`. Any request made after the deadline plus a 30s grace period auto-submits the attempt. Starting a level again while an attempt is in progress resumes that attempt.
- **Scoring:** a correct answer earns `marks_per_question × weightage` and a wrong answer loses `negative_marking × weightage`. Unanswered questions score 0.
- **Leaderboard:** `best_score` is the sum of the student's best score on each level. The tie-break is the average score. Ranks use `RANK()` and are rebuilt after every submit, which also updates `results.rank`.
- **Answer key:** students see the review with correct answers only after `exam_end`. Admins can always see it.
- **Discounts:** checked with a row lock. `used_count` goes up when payment is verified, or straight away for registrations that are free after the discount.
- **Payments:** the server charges `registrations.net_amount`. The client's `amount` must match it. Verification uses the Razorpay HMAC signature, and calling it again for the same payment returns the same result.
- **Practice:** needs a confirmed registration. The practice paper is rebuilt from the practice attempt id, so no extra table is needed.
- **Password reset:** uses a stateless JWT tied to the current password hash, so each token works only once. Outside production the token is also returned in the response for testing.
- **Notifications:** India SMS goes through the DLT gateway (a placeholder until the vendor is chosen). Other SMS goes through Twilio, and email through Twilio SendGrid. Raised automatically on registration confirmation, payment, result and password reset.
