CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  date_of_birth   DATE,
  gender          TEXT,
  school          TEXT,
  grade           TEXT,
  city            TEXT,
  state           TEXT,
  guardian_name   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  generator    TEXT NOT NULL DEFAULT 'bank' CHECK (generator IN ('maths', 'reasoning', 'bank')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL REFERENCES question_categories(id) ON DELETE CASCADE,
  complexity     TEXT NOT NULL CHECK (complexity IN ('low', 'medium', 'high')),
  text           TEXT NOT NULL,
  options        JSONB NOT NULL,
  correct_index  INT NOT NULL,
  explanation    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_cat_cx_idx ON questions (category_id, complexity);

CREATE TABLE exams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  description         TEXT,
  age_min             INT NOT NULL,
  age_max             INT NOT NULL,
  registration_start  TIMESTAMPTZ NOT NULL,
  registration_end    TIMESTAMPTZ NOT NULL,
  exam_start          TIMESTAMPTZ NOT NULL,
  exam_end            TIMESTAMPTZ NOT NULL,
  duration_minutes    INT NOT NULL,
  fee                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'INR',
  award               TEXT,
  practice_attempts   INT NOT NULL DEFAULT 1,
  is_published        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exam_levels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  level_number        INT NOT NULL,
  name                TEXT NOT NULL,
  category_id         UUID NOT NULL REFERENCES question_categories(id),
  complexity          TEXT NOT NULL CHECK (complexity IN ('low', 'medium', 'high')),
  question_count      INT NOT NULL,
  max_attempts        INT NOT NULL,
  pass_percentage     INT NOT NULL DEFAULT 0,
  marks_per_question  INT NOT NULL DEFAULT 1,
  UNIQUE (exam_id, level_number)
);

CREATE TABLE exam_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  capacity    INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
  value        NUMERIC(10,2) NOT NULL,
  exam_id      UUID REFERENCES exams(id) ON DELETE CASCADE,
  valid_from   TIMESTAMPTZ NOT NULL,
  valid_to     TIMESTAMPTZ NOT NULL,
  max_uses     INT,
  used_count   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id          UUID REFERENCES exam_slots(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  amount_base      NUMERIC(10,2) NOT NULL,
  discount_id      UUID REFERENCES discounts(id) ON DELETE SET NULL,
  discount_code    TEXT,
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_payable   NUMERIC(10,2) NOT NULL,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, user_id)
);

CREATE TABLE payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id      UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('razorpay', 'mock', 'free')),
  provider_order_id    TEXT UNIQUE,
  provider_payment_id  TEXT,
  provider_signature   TEXT,
  amount               NUMERIC(10,2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'INR',
  status               TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ
);
CREATE INDEX payments_reg_idx ON payments (registration_id);

CREATE TABLE payment_settings (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider        TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('razorpay', 'mock')),
  key_id          TEXT,
  key_secret      TEXT,
  webhook_secret  TEXT,
  currency        TEXT NOT NULL DEFAULT 'INR',
  business_name   TEXT NOT NULL DEFAULT 'Interglade Talent',
  mode            TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO payment_settings (id) VALUES (1);

CREATE TABLE attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id     UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id             UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  level_id            UUID NOT NULL REFERENCES exam_levels(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL CHECK (mode IN ('practice', 'real')),
  attempt_number      INT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  submitted_at        TIMESTAMPTZ,
  score               INT,
  max_score           INT NOT NULL,
  correct_count       INT,
  wrong_count         INT,
  unanswered_count    INT,
  time_taken_seconds  INT,
  UNIQUE (registration_id, level_id, mode, attempt_number)
);
CREATE INDEX attempts_exam_idx ON attempts (exam_id, mode, status);
-- At most one open attempt per student/level/mode
CREATE UNIQUE INDEX attempts_one_open_idx ON attempts (registration_id, level_id, mode) WHERE status = 'in_progress';

CREATE TABLE attempt_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id          UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  position            INT NOT NULL,
  text                TEXT NOT NULL,
  options             JSONB NOT NULL,
  correct_index       INT NOT NULL,
  explanation         TEXT,
  source_question_id  UUID REFERENCES questions(id) ON DELETE SET NULL,
  selected_index      INT,
  answered_at         TIMESTAMPTZ,
  UNIQUE (attempt_id, position)
);
