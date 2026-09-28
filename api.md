# Online Examination API — Route Reference

Base URL: `http://<host>:<port>/api` (prefix set by `API_PREFIX`, default `/api`)

## Conventions

**Authentication**: protected routes need the header
```
Authorization: Bearer <access_token>
```
Get the token from `POST /auth/login` (or `POST /auth/register`).

**Roles**: `student`, `admin`.

**Content type**: `Content-Type: application/json` (max body size 1 MB).

**Naming**: request and response fields use `snake_case`.

**Path params**: every `:xxxId` must be a valid UUID, or the API returns `400`.

**Success response**
```json
{ "success": true, "message": "OK", "data": { } }
```
`200` for reads and updates, `201` for creates.

**Error response**
```json
{ "success": false, "message": "Invalid request body", "details": { "formErrors": [], "fieldErrors": { "email": ["Invalid email address"] } } }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed, or the JSON body is malformed |
| 401 | Token is missing, invalid or expired |
| 403 | Your role is not allowed on this route |
| 404 | Resource or route not found |
| 409 | Duplicate value, or a foreign key conflict |
| 429 | Rate limit exceeded (auth routes have a stricter limit) |
| 500 | Internal server error |

**Paginated responses** have this shape:
```json
{ "items": [], "meta": { "page": 1, "size": 10, "total": 42, "total_pages": 5 } }
```

**Enums**
- Exam `status`: `draft` | `registration_open` | `ongoing` | `completed` | `cancelled`
- `complexity`: `low` | `medium` | `high`
- `discount_type`: `percentage` | `flat`
- Notification `event_type`: `REGISTRATION_CONFIRMED` | `PAYMENT_SUCCESS` | `PASSWORD_RESET` | `RESULT_PUBLISHED` | `EXAM_REMINDER` | `CUSTOM`

---

## Route Summary

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| POST | `/auth/change-password` | Any logged-in user |
| GET | `/exams` | Any logged-in user |
| GET | `/exams/:examId` | Any logged-in user |
| GET | `/exams/:examId/leaderboard` | Any logged-in user |
| POST | `/exams/:examId/attempts` | Student |
| GET | `/attempts/:attemptId/questions` | Student |
| PUT | `/attempts/:attemptId/questions/:attemptQuestionId` | Student |
| POST | `/attempts/:attemptId/submit` | Student |
| GET | `/attempts/:attemptId/result` | Student, Admin |
| POST | `/registrations` | Student |
| POST | `/payments/razorpay/order` | Student |
| POST | `/payments/razorpay/verify` | Student |
| GET | `/students/dashboard` | Student |
| POST | `/practice-tests/:practiceTestId/attempts` | Student |
| POST | `/practice-attempts/:attemptId/submit` | Student |
| GET | `/admin/dashboard` | Admin |
| GET | `/admin/exams/:examId/reports` | Admin |
| POST | `/admin/exams` | Admin |
| PUT | `/admin/exams/:examId` | Admin |
| PATCH | `/admin/exams/:examId/publish` | Admin |
| DELETE | `/admin/exams/:examId` | Admin |
| POST | `/admin/exams/:examId/levels` | Admin |
| PUT | `/admin/levels/:levelId` | Admin |
| POST | `/admin/levels/:levelId/categories` | Admin |
| POST | `/admin/questions` | Admin |
| PUT | `/admin/questions/:questionId` | Admin |
| POST | `/admin/practice-tests` | Admin |
| POST | `/admin/discounts` | Admin |
| PUT | `/admin/discounts/:discountId` | Admin |
| POST | `/notifications/events` | Admin |
| POST | `/notifications/:notificationId/retry` | Admin |

---

## Health

### GET `/health`
Public. No body.

Response `200`:
```json
{ "success": true, "message": "OK", "data": { "status": "up", "time": "2026-09-28T10:00:00.000Z" } }
```

---

## Auth

The register, login, forgot-password and reset-password routes have a stricter rate limit.

### POST `/auth/register`
Public. Returns `201` with the message "Registration successful".

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | one of `email` / `mobile` | valid email; trimmed and lowercased |
| `mobile` | string | one of `email` / `mobile` | 7–15 digits, optional leading `+` |
| `password` | string | yes | 8–128 characters |
| `country_code` | string | no | ISO‑3166 alpha‑2 code; default `IN` |
| `profile.first_name` | string | yes | 1–100 characters |
| `profile.last_name` | string | no | max 100 characters |
| `profile.school_name` | string | no | max 255 characters |
| `profile.class_name` | string | no | max 100 characters |
| `profile.contact_details` | string | no | max 1000 characters |

```json
{
  "email": "student@example.com",
  "mobile": "+919876543210",
  "password": "Secret@123",
  "country_code": "IN",
  "profile": {
    "first_name": "Asha",
    "last_name": "Patil",
    "school_name": "City High School",
    "class_name": "8th",
    "contact_details": "Pune"
  }
}
```
Returns `409` if the email or mobile is already registered.

### POST `/auth/login`
Public.

| Field | Type | Required | Rules |
|---|---|---|---|
| `email_or_mobile` | string | yes | min 3 characters |
| `password` | string | yes | min 1 character |

```json
{ "email_or_mobile": "student@example.com", "password": "Secret@123" }
```
Response `200` (`data`):
```json
{ "access_token": "eyJ...", "token_type": "Bearer", "expires_in": "1d", "user": { "user_id": "…", "email": "…", "role": "student" } }
```

### POST `/auth/forgot-password`
Public.

| Field | Type | Required | Rules |
|---|---|---|---|
| `email_or_mobile` | string | yes | min 3 characters |

```json
{ "email_or_mobile": "student@example.com" }
```

### POST `/auth/reset-password`
Public.

| Field | Type | Required | Rules |
|---|---|---|---|
| `token` | string | yes | min 10 characters (the reset token sent to the user) |
| `new_password` | string | yes | 8–128 characters |

```json
{ "token": "reset-token-from-message", "new_password": "NewSecret@123" }
```
Response `data`: `{ "message": "Password has been reset" }`

### POST `/auth/change-password`
Auth: any logged-in user.

| Field | Type | Required | Rules |
|---|---|---|---|
| `current_password` | string | yes | min 1 character |
| `new_password` | string | yes | 8–128 characters; must differ from `current_password` |

```json
{ "current_password": "Secret@123", "new_password": "NewSecret@123" }
```
Response `data`: `{ "message": "Password changed" }`. Returns `400` if the current password is wrong.

---

## Exams

### GET `/exams`
Auth: any logged-in user. No body. Returns a paginated list.

| Query | Type | Required | Rules |
|---|---|---|---|
| `status` | enum | no | exam status |
| `search` | string | no | max 100 characters |
| `page` | int | no | ≥ 1, default 1 |
| `size` | int | no | 1–100, default 10 |

Example: `GET /api/exams?status=registration_open&search=math&page=1&size=10`

### GET `/exams/:examId`
Auth: any logged-in user. No body. Returns exam details.

### GET `/exams/:examId/leaderboard`
Auth: any logged-in user. No body. Returns a paginated list.

| Query | Type | Required | Rules |
|---|---|---|---|
| `page` | int | no | ≥ 1, default 1 |
| `size` | int | no | 1–100, default 20 |

### POST `/exams/:examId/attempts`
Auth: student. Starts an exam attempt for a level.

- `201` "Attempt started": a new attempt was created.
- `200` "Resuming attempt in progress": an attempt was already in progress, and it is returned.

| Field | Type | Required | Rules |
|---|---|---|---|
| `level_id` | uuid | yes | |

```json
{ "level_id": "8f1c2c1e-3b1a-4d8e-9f0a-1a2b3c4d5e6f" }
```

---

## Attempts

### GET `/attempts/:attemptId/questions`
Auth: student. No body. Returns the questions for the attempt.

### PUT `/attempts/:attemptId/questions/:attemptQuestionId`
Auth: student. Saves the answer to one question. Response message: "Answer saved".

| Field | Type | Required | Rules |
|---|---|---|---|
| `selected_option_id` | uuid \| null | no* | |
| `is_skipped` | boolean | no* | cannot be `true` together with a `selected_option_id` |
| `is_flagged` | boolean | no* | |

\* Send at least one of the three fields.

```json
{ "selected_option_id": "2d6a…", "is_flagged": false }
```

### POST `/attempts/:attemptId/submit`
Auth: student. The response message is "Attempt submitted", or "Attempt was already submitted" if it was submitted before.

| Field | Type | Required | Rules |
|---|---|---|---|
| `answers` | array | no | default `[]` |
| `answers[].attempt_question_id` | uuid | yes | |
| `answers[].selected_option_id` | uuid \| null | yes | |
| `auto_submit` | boolean | no | default `false`; the client sets it to `true` when the timer runs out |

```json
{
  "answers": [
    { "attempt_question_id": "a1b2…", "selected_option_id": "c3d4…" },
    { "attempt_question_id": "e5f6…", "selected_option_id": null }
  ],
  "auto_submit": false
}
```

### GET `/attempts/:attemptId/result`
Auth: student or admin. No body. Returns the result of the attempt.

---

## Registrations

### POST `/registrations`
Auth: student. Returns `201`.

- "Registration confirmed": the registration is free, or the discount covers the full fee.
- "Registered; payment pending": the student still has to pay.

| Field | Type | Required | Rules |
|---|---|---|---|
| `exam_id` | uuid | yes | |
| `discount_code` | string | no | 1–100 characters |

```json
{ "exam_id": "9b2e…", "discount_code": "EARLY50" }
```

---

## Payments (Razorpay)

### POST `/payments/razorpay/order`
Auth: student. Creates a Razorpay order. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `registration_id` | uuid | yes | |
| `amount` | number | yes | > 0 |
| `currency` | string | yes | 3 letters, uppercased (e.g. `INR`) |

```json
{ "registration_id": "4c7d…", "amount": 499, "currency": "INR" }
```

### POST `/payments/razorpay/verify`
Auth: student. Verifies the payment signature from Razorpay Checkout and confirms the registration.

| Field | Type | Required | Rules |
|---|---|---|---|
| `registration_id` | uuid | yes | |
| `razorpay_order_id` | string | yes | 1–255 characters |
| `razorpay_payment_id` | string | yes | 1–255 characters |
| `razorpay_signature` | string | yes | 1–512 characters |

```json
{
  "registration_id": "4c7d…",
  "razorpay_order_id": "order_Nx…",
  "razorpay_payment_id": "pay_Nx…",
  "razorpay_signature": "e3b0c442…"
}
```

---

## Students

### GET `/students/dashboard`
Auth: student. No body. Returns the logged-in student's dashboard.

---

## Practice

### POST `/practice-tests/:practiceTestId/attempts`
Auth: student. No body.

- `201` "Practice attempt started": a new attempt was created.
- `200` "Resuming practice attempt": an attempt was already in progress, and it is returned.

### POST `/practice-attempts/:attemptId/submit`
Auth: student. Response message: "Practice submitted".

| Field | Type | Required | Rules |
|---|---|---|---|
| `answers` | array | no | default `[]` |
| `answers[].question_id` | uuid | yes | |
| `answers[].selected_option_id` | uuid \| null | yes | |

```json
{ "answers": [ { "question_id": "q1…", "selected_option_id": "o1…" } ] }
```

---

## Admin

All `/admin/*` routes need an **admin** token.

### GET `/admin/dashboard`
No body. Returns admin dashboard stats.

### GET `/admin/exams/:examId/reports`
No body. Returns the report for one exam.

### POST `/admin/exams`
Creates an exam. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 1–255 characters |
| `description` | string \| null | no | |
| `syllabus` | string \| null | no | |
| `registration_start` | date (ISO) | yes | |
| `registration_end` | date (ISO) | yes | |
| `exam_start` | date (ISO) | yes | |
| `exam_end` | date (ISO) | yes | |
| `fee` | number | yes | 0 – 9,999,999,999.99 |
| `currency` | string | no | 3 letters; default `INR` |
| `status` | enum | no | default `draft` |
| `is_published` | boolean | no | default `false` |
| `award` | string \| null | no | |

The dates must satisfy these rules:
- `registration_start` < `registration_end`
- `exam_start` < `exam_end`
- `registration_start` ≤ `exam_start`
- `registration_end` ≤ `exam_end`

```json
{
  "name": "Maths Olympiad 2026",
  "description": "National level maths olympiad",
  "syllabus": "Algebra, Geometry",
  "registration_start": "2026-10-01T00:00:00Z",
  "registration_end": "2026-10-20T23:59:59Z",
  "exam_start": "2026-10-25T09:00:00Z",
  "exam_end": "2026-10-25T12:00:00Z",
  "fee": 499,
  "currency": "INR",
  "status": "draft",
  "is_published": false,
  "award": "Gold medal and certificate"
}
```

### PUT `/admin/exams/:examId`
Updates an exam. Takes the same fields as create, but every field is optional (partial update). Send at least one field. Fields you leave out are not changed.

```json
{ "fee": 399, "status": "registration_open" }
```

### PATCH `/admin/exams/:examId/publish`
Publishes or hides an exam. The response message is "Exam published" or "Exam hidden".

| Field | Type | Required |
|---|---|---|
| `is_published` | boolean | yes |

```json
{ "is_published": true }
```

### DELETE `/admin/exams/:examId`
No body. Response message: "Exam deleted".

### POST `/admin/exams/:examId/levels`
Creates a level in an exam. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `level_number` | int | yes | ≥ 1 |
| `name` | string | no | 1–255 characters |
| `duration_minutes` | int | yes | 1–1440 |
| `question_count` | int | yes | 1–1000 |
| `max_score` | number | yes | ≥ 0 |
| `attempts_allowed` | int | no | ≥ 1, default 1 |

```json
{ "level_number": 1, "name": "Level 1", "duration_minutes": 60, "question_count": 50, "max_score": 100, "attempts_allowed": 1 }
```

### PUT `/admin/levels/:levelId`
Takes the same fields as creating a level, but every field is optional. Send at least one field.

```json
{ "duration_minutes": 90 }
```

### POST `/admin/levels/:levelId/categories`
Creates a question category in a level. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `category_name` | string | yes | 1–255 characters |
| `complexity` | enum | yes | `low` / `medium` / `high` |
| `marks_per_question` | number | yes | > 0 |
| `negative_marking` | number | no | ≥ 0, default 0 |

```json
{ "category_name": "Algebra - Easy", "complexity": "low", "marks_per_question": 2, "negative_marking": 0.5 }
```

### POST `/admin/questions`
Creates a question in the question bank. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `question_text` | string | yes | min 1 character |
| `complexity` | enum | yes | `low` / `medium` / `high` |
| `explanation` | string \| null | no | |
| `is_active` | boolean | no | default `true` |
| `options` | array | yes | 2–10 items; **exactly one** must have `is_correct: true` |
| `options[].option_text` | string | yes | min 1 character |
| `options[].is_correct` | boolean | no | default `false` |
| `level_categories` | array | no | default `[]`; no duplicate `level_category_id` values |
| `level_categories[].level_category_id` | uuid | yes | |
| `level_categories[].weightage` | number | no | > 0, default 1 |

```json
{
  "question_text": "What is 2 + 2?",
  "complexity": "low",
  "explanation": "Basic addition.",
  "is_active": true,
  "options": [
    { "option_text": "3", "is_correct": false },
    { "option_text": "4", "is_correct": true },
    { "option_text": "5" }
  ],
  "level_categories": [
    { "level_category_id": "7a1e…", "weightage": 1 }
  ]
}
```

### PUT `/admin/questions/:questionId`
Takes the same fields as create, but every field is optional. Send at least one field. If you send `options`, it replaces the full option list and must follow the same rules as on create.

```json
{ "is_active": false }
```

### POST `/admin/practice-tests`
Creates or updates the practice test for an exam.

- `201` "Practice test configured": a new practice test was created.
- `200` "Practice test updated": the exam's existing practice test was updated.

| Field | Type | Required | Rules |
|---|---|---|---|
| `exam_id` | uuid | yes | |
| `attempts_allowed` | int | yes | ≥ 1 |
| `duration_minutes` | int | yes | 1–1440 |
| `question_count` | int | yes | 1–1000 |

```json
{ "exam_id": "9b2e…", "attempts_allowed": 3, "duration_minutes": 30, "question_count": 20 }
```

### POST `/admin/discounts`
Creates a discount code. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | 3–100 characters, uppercased; only `A-Z 0-9 _ -` |
| `discount_type` | enum | yes | `percentage` / `flat` |
| `discount_value` | number | yes | > 0; at most 100 when `percentage` |
| `valid_from` | date (ISO) | yes | must be before `valid_to` |
| `valid_to` | date (ISO) | yes | |
| `usage_limit` | int | yes | ≥ 1 |
| `max_discount` | number \| null | no | > 0 |
| `exam_id` | uuid \| null | no | null means the code works for every exam |
| `is_active` | boolean | no | default `true` |

```json
{
  "code": "EARLY50",
  "discount_type": "percentage",
  "discount_value": 50,
  "valid_from": "2026-10-01T00:00:00Z",
  "valid_to": "2026-10-15T23:59:59Z",
  "usage_limit": 100,
  "max_discount": 250,
  "exam_id": null,
  "is_active": true
}
```

### PUT `/admin/discounts/:discountId`
Takes the same fields as create, but every field is optional. Send at least one field.

```json
{ "is_active": false }
```

---

## Notifications

Both routes need an **admin** token.

### POST `/notifications/events`
Raises a notification event for a user and waits until delivery has been attempted. Returns `201`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `user_id` | uuid | yes | |
| `event_type` | enum | yes | see Enums |
| `payload` | object | no | any key/value pairs used by the message template; default `{}` |

```json
{
  "user_id": "1f2e…",
  "event_type": "EXAM_REMINDER",
  "payload": { "exam_name": "Maths Olympiad 2026", "exam_start": "2026-10-25 09:00" }
}
```

### POST `/notifications/:notificationId/retry`
No body. Retries a notification whose delivery failed or partly failed. Response message: "Notification retried".
