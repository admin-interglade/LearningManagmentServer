# Interglade Talent — Online Exam System API

Node.js + TypeScript + Express 5 + PostgreSQL. Requirements, design decisions: [../docs/REQUIREMENTS.md](../docs/REQUIREMENTS.md). Endpoint contract: [../docs/API.md](../docs/API.md).

## Setup

```bash
cp .env.example .env            # set DATABASE_URL, JWT_SECRET
createdb interglade_exam
npm install
npm run db:seed                 # runs migrations + seeds admin, categories, question bank, 2 demo exams, EARLY20 coupon
npm run dev                     # http://localhost:4000/api/health
```

Admin login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@interglade.com` / `Admin@12345`).

| Script | Purpose |
|---|---|
| `npm run dev` | Watch mode (tsx) |
| `npm run build && npm start` | Compile to `dist/` and run |
| `npm run db:migrate` | Apply pending SQL migrations in `src/db/migrations` |
| `npm run db:seed` | Migrate + seed (idempotent) |
| `npm test` | End-to-end API tests — needs a migrated + seeded DB (use a separate test database) |
| `npm run typecheck` | Type-check only |

## Structure

```
src/
  server.ts, app.ts, routes.ts      # bootstrap, middleware, route mounting (/api, /api/student, /api/admin)
  config/env.ts                     # typed env
  db/                               # pg pool + transactions, migration runner, seed, migrations/*.sql
  common/                           # errors, zod validation, JWT auth + role guard, error handler, time helpers
  modules/<name>/
    <name>.routes.ts                # routing + validation middleware
    <name>.controller.ts            # HTTP in/out
    <name>.service.ts               # business logic + SQL
    <name>.schema.ts                # zod request schemas
```

Modules: `auth`, `users` (profile), `public`, `question-bank` (categories, questions, generators), `exams` (exams, levels, slots),
`discounts`, `payments` (Razorpay, settings, webhook), `registrations` (student registration, slot, progress, dashboard),
`attempts` (practice/real exam engine), `leaderboard`, `dashboard` (admin), `students` (admin).

## Key rules
- **Exam status**: `draft` (unpublished) → `future` → `in_progress` → `completed`, from the exam window.
- **Levels**: level N+1 unlocks when best real score of level N ≥ its pass %. Level score = best of its attempts.
- **Ranking**: sum of best level scores, ties → less total time → earlier registration.
- **Real attempts** only inside the student's booked slot; **practice** any time after payment until the exam ends.
- **Questions**: `maths` / `reasoning` categories are procedurally generated per complexity; `bank` categories draw from the question bank. Each attempt snapshots its questions; answers are hidden until submission. Timer is server-enforced (auto-submit on expiry).
- **Payments**: set Razorpay keys in *Admin → Payment settings* (`PUT /api/admin/settings/payment`). Until then the API runs in **mock** mode (`POST /api/payments/mock-complete`). Configure the Razorpay webhook to `POST /api/payments/webhook` (events `payment.captured`, `order.paid`) with the webhook secret.
- **Password reset**: emails via SMTP when `SMTP_HOST` is set, else logged to console; outside production the token is also returned as `devResetToken`.
