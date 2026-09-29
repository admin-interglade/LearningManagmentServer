# Interglade Talent — Online Exam System (Phase 1)

## Roles
- **Student** — self-registers with email or phone.
- **Admin** — seeded account; manages exams, question bank, discounts, payment settings.

## Review notes — gaps in the original brief and the decisions taken

| # | Gap | Decision |
|---|-----|----------|
| 1 | Completed / In Progress / Future cannot be derived from registration dates alone | Exam has an **exam window** (`examStart`, `examEnd`) in addition to the registration window. Status: `future` (now < examStart), `in_progress` (examStart ≤ now ≤ examEnd), `completed` (now > examEnd). Unpublished exams are `draft`. |
| 2 | No registration fee in the brief | Exam has `fee` (INR). Fee `0` = free exam, no payment step. |
| 3 | "Exam duration" vs levels | `durationMinutes` is set on the exam and applies to every level attempt. Each level also has `questionCount`. |
| 4 | How levels progress | Each level has `passPercent`. Real attempts at level N+1 unlock when best real score at level N ≥ pass %. Level 1 is always unlocked. |
| 5 | Level score | Best of all submitted real attempts at that level. |
| 6 | Ranking | Sum of best level scores; tie-break by lower total time of those best attempts, then earlier registration. |
| 7 | Slots | Slot = time window + capacity. Student picks one slot per registered exam; **real** attempts only within the chosen slot window. Practice any time after registration is confirmed. Slot can be changed until it starts. |
| 8 | Practice test | `practiceAttempts` per level (configured on the exam). Practice results never count toward ranking. |
| 9 | Age group | Exam has `ageGroupMin`/`ageGroupMax` (null = open to all ages); checked against student's date of birth (age on `examStart`) at registration. DOB is required at sign-up. |
| 10 | Discount | Coupon codes: `percent` or `flat`, optional exam scope, validity window, max uses. |
| 11 | Question auto-generation | Per category a generator: `maths` and `reasoning` are procedurally generated per complexity (unlimited unique questions); `bank` categories draw random questions from the admin-managed bank. Each attempt gets a fresh set (snapshotted). |
| 12 | Payment | Razorpay Orders API + checkout.js + HMAC signature verification + webhook. If Razorpay keys are not configured, the system runs in **mock** mode for development. Key secret is write-only via API. |
| 13 | Forgot password | Email/phone → reset token (valid 30 min). Email sent via SMTP when configured, otherwise logged to console (and returned in the response outside production). SMS provider is a Phase 2 item. |
| 14 | Timer | Server enforced. Answers are saved per question; expired attempts auto-submit on next access. |

## Out of scope for Phase 1 (suggested Phase 2)
SMS OTP provider, certificates/award PDF generation, proctoring, refunds, AI-generated question banks for free-text categories, multi-admin permissions.
