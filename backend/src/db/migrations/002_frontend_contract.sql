-- Aligns the schema with the front-end contract (docs/API.md):
-- multi-section levels, per-level slots, GST, multi-exam discounts and extra profile fields.

-- Users: phone is stored as sent ("+91 9876543210"); phone_digits is the normalised form used for
-- uniqueness and login (10-digit numbers are treated as Indian, i.e. prefixed with 91).
ALTER TABLE users ADD COLUMN guardian_phone TEXT;
ALTER TABLE users ADD COLUMN phone_digits TEXT;
UPDATE users SET phone_digits = CASE
    WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10 THEN '91' || regexp_replace(phone, '\D', '', 'g')
    ELSE regexp_replace(phone, '\D', '', 'g') END
  WHERE phone IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_phone_key;
CREATE UNIQUE INDEX users_phone_digits_idx ON users (phone_digits);

-- The fixed subject list the UI offers; admins may add more through /admin/categories.
UPDATE question_categories SET name = 'Mathematics', slug = 'mathematics'
  WHERE name = 'Maths' AND NOT EXISTS (SELECT 1 FROM question_categories WHERE name = 'Mathematics');
INSERT INTO question_categories (name, slug, description, generator) VALUES
  ('Mathematics', 'mathematics', 'Arithmetic, algebra and applied maths (auto-generated)', 'maths'),
  ('Science', 'science', 'Admin-managed question bank', 'bank'),
  ('English', 'english', 'Admin-managed question bank', 'bank'),
  ('Logical Reasoning', 'logical-reasoning', 'Series, patterns and coding-decoding (auto-generated)', 'reasoning'),
  ('General Knowledge', 'general-knowledge', 'Admin-managed question bank', 'bank'),
  ('Computers', 'computers', 'Admin-managed question bank', 'bank')
ON CONFLICT DO NOTHING;

-- Exams: nullable age group means "open to all ages".
ALTER TABLE exams ALTER COLUMN age_min DROP NOT NULL, ALTER COLUMN age_max DROP NOT NULL;
ALTER TABLE exams ADD COLUMN practice_question_count INT NOT NULL DEFAULT 10;

-- Levels: own duration; the question mix moves to sections.
ALTER TABLE exam_levels ADD COLUMN duration_minutes INT;
UPDATE exam_levels l SET duration_minutes = e.duration_minutes FROM exams e WHERE e.id = l.exam_id;
ALTER TABLE exam_levels ALTER COLUMN duration_minutes SET NOT NULL;

CREATE TABLE level_sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id            UUID NOT NULL REFERENCES exam_levels(id) ON DELETE CASCADE,
  position            INT NOT NULL,
  category_id         UUID NOT NULL REFERENCES question_categories(id),
  complexity          TEXT NOT NULL CHECK (complexity IN ('low', 'medium', 'high')),
  question_count      INT NOT NULL CHECK (question_count > 0),
  marks_per_question  INT NOT NULL DEFAULT 1
);
CREATE INDEX level_sections_level_idx ON level_sections (level_id, position);
INSERT INTO level_sections (level_id, position, category_id, complexity, question_count, marks_per_question)
  SELECT id, 1, category_id, complexity, question_count, marks_per_question FROM exam_levels;
ALTER TABLE exam_levels DROP COLUMN category_id, DROP COLUMN complexity,
  DROP COLUMN question_count, DROP COLUMN marks_per_question;

-- Slots belong to a level; a registration books one slot per level.
ALTER TABLE exam_slots ADD COLUMN level_id UUID REFERENCES exam_levels(id) ON DELETE CASCADE;
UPDATE exam_slots s SET level_id = (SELECT l.id FROM exam_levels l WHERE l.exam_id = s.exam_id ORDER BY l.level_number LIMIT 1);
DELETE FROM exam_slots WHERE level_id IS NULL;
ALTER TABLE exam_slots ALTER COLUMN level_id SET NOT NULL;
CREATE INDEX exam_slots_level_idx ON exam_slots (level_id, start_at);

CREATE TABLE registration_slots (
  registration_id  UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  level_id         UUID NOT NULL REFERENCES exam_levels(id) ON DELETE CASCADE,
  slot_id          UUID NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
  booked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, level_id)
);
CREATE INDEX registration_slots_slot_idx ON registration_slots (slot_id);
INSERT INTO registration_slots (registration_id, level_id, slot_id)
  SELECT r.id, s.level_id, s.id FROM registrations r JOIN exam_slots s ON s.id = r.slot_id;
ALTER TABLE registrations DROP COLUMN slot_id;

-- GST on the discounted amount. amount_payable is the final total (taxable + tax).
ALTER TABLE registrations ADD COLUMN tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Payments keep their own price snapshot so the ledger stays correct if the student re-orders.
ALTER TABLE payments
  ADD COLUMN gross            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tax_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_code    TEXT,
  ADD COLUMN method           TEXT;
UPDATE payments p SET gross = r.amount_base, discount_amount = r.discount_amount, discount_code = r.discount_code
  FROM registrations r WHERE r.id = p.registration_id;
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
UPDATE payments SET status = 'pending' WHERE status = 'created';
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE payment_settings
  ADD COLUMN merchant_email  TEXT,
  ADD COLUMN gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 18,
  ADD COLUMN enabled         BOOLEAN NOT NULL DEFAULT TRUE;

-- Discounts can target several exams (empty = every exam).
ALTER TABLE discounts ADD COLUMN exam_ids UUID[] NOT NULL DEFAULT '{}';
UPDATE discounts SET exam_ids = ARRAY[exam_id] WHERE exam_id IS NOT NULL;
ALTER TABLE discounts DROP COLUMN exam_id;
ALTER TABLE discounts RENAME COLUMN description TO label;

-- Each question of a paper remembers its section so the UI can show category, complexity and marks.
ALTER TABLE attempt_questions
  ADD COLUMN category    TEXT NOT NULL DEFAULT '',
  ADD COLUMN complexity  TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN marks       INT NOT NULL DEFAULT 1;
