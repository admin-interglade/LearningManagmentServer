import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790596096757 implements MigrationInterface {
    name = 'InitialSchema1790596096757'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "question_options" ("option_id" uuid NOT NULL DEFAULT gen_random_uuid(), "question_id" uuid NOT NULL, "option_text" text NOT NULL, "is_correct" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_94879b352f20019dba3485a6d35" PRIMARY KEY ("option_id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("role_id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(50) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_09f4c8130b54f35925588a37b6a" PRIMARY KEY ("role_id"))`);
        await queryRunner.query(`CREATE TABLE "student_profiles" ("student_id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100), "school_name" character varying(255), "class_name" character varying(100), "contact_details" text, CONSTRAINT "UQ_cef016a0d95e26ae7c0f167ec28" UNIQUE ("user_id"), CONSTRAINT "REL_cef016a0d95e26ae7c0f167ec2" UNIQUE ("user_id"), CONSTRAINT "PK_4cedc08d3dc1f2c2da8a12f7a88" PRIMARY KEY ("student_id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("user_id" uuid NOT NULL DEFAULT gen_random_uuid(), "role_id" uuid NOT NULL, "email" character varying(255), "mobile" character varying(30), "password_hash" text NOT NULL, "country_code" character varying(10) NOT NULL DEFAULT 'IN', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_d376a9f93bba651f32a2c03a7d3" UNIQUE ("mobile"), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "practice_attempts" ("practice_attempt_id" uuid NOT NULL DEFAULT gen_random_uuid(), "practice_test_id" uuid NOT NULL, "student_id" uuid NOT NULL, "started_at" TIMESTAMP NOT NULL, "submitted_at" TIMESTAMP, "score" numeric(10,2), "status" character varying(30) NOT NULL, CONSTRAINT "PK_c84097b10e60a0ca2b51c99c82f" PRIMARY KEY ("practice_attempt_id"))`);
        await queryRunner.query(`CREATE TABLE "practice_tests" ("practice_test_id" uuid NOT NULL DEFAULT gen_random_uuid(), "exam_id" uuid NOT NULL, "attempts_allowed" integer NOT NULL, "duration_minutes" integer NOT NULL, "question_count" integer NOT NULL, CONSTRAINT "UQ_2df0993fae57505c68b3d066d95" UNIQUE ("exam_id"), CONSTRAINT "REL_2df0993fae57505c68b3d066d9" UNIQUE ("exam_id"), CONSTRAINT "PK_d5856946ad93614a2c79374f49d" PRIMARY KEY ("practice_test_id"))`);
        await queryRunner.query(`CREATE TABLE "exams" ("exam_id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NOT NULL, "description" text, "syllabus" text, "registration_start" TIMESTAMP NOT NULL, "registration_end" TIMESTAMP NOT NULL, "exam_start" TIMESTAMP NOT NULL, "exam_end" TIMESTAMP NOT NULL, "fee" numeric(12,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'INR', "status" character varying(30) NOT NULL DEFAULT 'draft', "is_published" boolean NOT NULL DEFAULT false, "award" text, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7fa41a3a161c719dbb3bbd67eef" PRIMARY KEY ("exam_id"))`);
        await queryRunner.query(`CREATE TABLE "exam_levels" ("level_id" uuid NOT NULL DEFAULT gen_random_uuid(), "exam_id" uuid NOT NULL, "level_number" integer NOT NULL, "name" character varying(255) NOT NULL, "duration_minutes" integer NOT NULL, "question_count" integer NOT NULL, "max_score" numeric(10,2) NOT NULL, "attempts_allowed" integer NOT NULL DEFAULT '1', CONSTRAINT "uq_exam_levels_exam_level_number" UNIQUE ("exam_id", "level_number"), CONSTRAINT "PK_edf00184c0edd3164401e9efbb6" PRIMARY KEY ("level_id"))`);
        await queryRunner.query(`CREATE TABLE "level_categories" ("level_category_id" uuid NOT NULL DEFAULT gen_random_uuid(), "level_id" uuid NOT NULL, "category_name" character varying(255) NOT NULL, "complexity" character varying(20) NOT NULL, "marks_per_question" numeric(10,2) NOT NULL, "negative_marking" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_98ec9ea3d9b391bd345d5ced3b5" PRIMARY KEY ("level_category_id"))`);
        await queryRunner.query(`CREATE TABLE "level_questions" ("level_question_id" uuid NOT NULL DEFAULT gen_random_uuid(), "level_category_id" uuid NOT NULL, "question_id" uuid NOT NULL, "weightage" numeric(10,2) NOT NULL DEFAULT '1', CONSTRAINT "uq_level_questions_category_question" UNIQUE ("level_category_id", "question_id"), CONSTRAINT "PK_b55a7c6a459cb2320f5f12762aa" PRIMARY KEY ("level_question_id"))`);
        await queryRunner.query(`CREATE TABLE "questions" ("question_id" uuid NOT NULL DEFAULT gen_random_uuid(), "question_text" text NOT NULL, "complexity" character varying(20) NOT NULL, "explanation" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8e940ecc478000e09fa8b008ec6" PRIMARY KEY ("question_id"))`);
        await queryRunner.query(`CREATE TABLE "discount_codes" ("discount_id" uuid NOT NULL DEFAULT gen_random_uuid(), "code" character varying(100) NOT NULL, "discount_type" character varying(20) NOT NULL, "discount_value" numeric(12,2) NOT NULL, "valid_from" TIMESTAMP NOT NULL, "valid_to" TIMESTAMP NOT NULL, "usage_limit" integer NOT NULL, "used_count" integer NOT NULL DEFAULT '0', "max_discount" numeric(12,2), "exam_id" uuid, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_b967edd0d46547d4a92b4a1c6b3" UNIQUE ("code"), CONSTRAINT "PK_ec391467fdc8f31ff111548fa0c" PRIMARY KEY ("discount_id"))`);
        await queryRunner.query(`CREATE TABLE "payments" ("payment_id" uuid NOT NULL DEFAULT gen_random_uuid(), "registration_id" uuid NOT NULL, "provider" character varying(50) NOT NULL DEFAULT 'razorpay', "order_id" character varying(255) NOT NULL, "payment_id_external" character varying(255), "signature" text, "amount" numeric(12,2) NOT NULL, "currency" character varying(10) NOT NULL, "status" character varying(30) NOT NULL, "verified_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b2f7b823a21562eeca20e72b006" UNIQUE ("order_id"), CONSTRAINT "PK_8866a3cfff96b8e17c2b204aae0" PRIMARY KEY ("payment_id"))`);
        await queryRunner.query(`CREATE TABLE "registrations" ("registration_id" uuid NOT NULL DEFAULT gen_random_uuid(), "student_id" uuid NOT NULL, "exam_id" uuid NOT NULL, "discount_id" uuid, "gross_amount" numeric(12,2) NOT NULL, "discount_amount" numeric(12,2) NOT NULL DEFAULT '0', "net_amount" numeric(12,2) NOT NULL, "payment_status" character varying(30) NOT NULL, "registration_status" character varying(30) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_registrations_student_exam" UNIQUE ("student_id", "exam_id"), CONSTRAINT "PK_c8949057f7da2bee22a15d7cb26" PRIMARY KEY ("registration_id"))`);
        await queryRunner.query(`CREATE TABLE "exam_attempts" ("attempt_id" uuid NOT NULL DEFAULT gen_random_uuid(), "registration_id" uuid NOT NULL, "level_id" uuid NOT NULL, "attempt_number" integer NOT NULL, "generation_seed" bigint NOT NULL, "started_at" TIMESTAMP NOT NULL, "submitted_at" TIMESTAMP, "status" character varying(30) NOT NULL, "auto_submitted" boolean NOT NULL DEFAULT false, CONSTRAINT "uq_exam_attempts_registration_level_number" UNIQUE ("registration_id", "level_id", "attempt_number"), CONSTRAINT "PK_91765a62ebdd8f7024043dfffed" PRIMARY KEY ("attempt_id"))`);
        await queryRunner.query(`CREATE TABLE "attempt_questions" ("attempt_question_id" uuid NOT NULL DEFAULT gen_random_uuid(), "attempt_id" uuid NOT NULL, "question_id" uuid NOT NULL, "question_order" integer NOT NULL, "selected_option_id" uuid, "is_skipped" boolean NOT NULL DEFAULT false, "is_flagged" boolean NOT NULL DEFAULT false, "answered_at" TIMESTAMP, CONSTRAINT "PK_dfb2150d9ee4cdc59ed9ac7188b" PRIMARY KEY ("attempt_question_id"))`);
        await queryRunner.query(`CREATE TABLE "notification_deliveries" ("delivery_id" uuid NOT NULL DEFAULT gen_random_uuid(), "notification_id" uuid NOT NULL, "provider" character varying(50) NOT NULL, "channel" character varying(20) NOT NULL, "external_message_id" character varying(255), "status" character varying(30) NOT NULL, "retry_count" integer NOT NULL DEFAULT '0', "delivered_at" TIMESTAMP, "failure_reason" text, CONSTRAINT "PK_8ba2001ba58ce38ed0b75920f73" PRIMARY KEY ("delivery_id"))`);
        await queryRunner.query(`CREATE TABLE "notifications" ("notification_id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "event_type" character varying(100) NOT NULL, "template_code" character varying(100) NOT NULL, "country_code" character varying(10) NOT NULL, "payload_json" json, "status" character varying(30) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eaedfe19f0f765d26afafa85956" PRIMARY KEY ("notification_id"))`);
        await queryRunner.query(`CREATE TABLE "leaderboards" ("leaderboard_id" uuid NOT NULL DEFAULT gen_random_uuid(), "exam_id" uuid NOT NULL, "student_id" uuid NOT NULL, "best_score" numeric(10,2) NOT NULL, "average_score" numeric(10,2) NOT NULL, "rank" integer NOT NULL, "tie_break_value" numeric(10,2), "published_at" TIMESTAMP NOT NULL, CONSTRAINT "uq_leaderboards_exam_student" UNIQUE ("exam_id", "student_id"), CONSTRAINT "PK_20c4fab8913542a6224c90aa57d" PRIMARY KEY ("leaderboard_id"))`);
        await queryRunner.query(`CREATE TABLE "results" ("result_id" uuid NOT NULL DEFAULT gen_random_uuid(), "attempt_id" uuid NOT NULL, "student_id" uuid NOT NULL, "exam_id" uuid NOT NULL, "level_id" uuid NOT NULL, "score" numeric(10,2) NOT NULL, "marks_earned" numeric(10,2) NOT NULL, "marks_lost" numeric(10,2) NOT NULL, "unattempted_count" integer NOT NULL, "average_score" numeric(10,2) NOT NULL, "rank" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ec9206067e7e8ef8f2511ae9b01" UNIQUE ("attempt_id"), CONSTRAINT "REL_ec9206067e7e8ef8f2511ae9b0" UNIQUE ("attempt_id"), CONSTRAINT "PK_3c8f50c2bb1131ae2acc86bb48e" PRIMARY KEY ("result_id"))`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c" FOREIGN KEY ("question_id") REFERENCES "questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_profiles" ADD CONSTRAINT "FK_cef016a0d95e26ae7c0f167ec28" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "practice_attempts" ADD CONSTRAINT "FK_0f4a51ba4191cd8257b53cafbb4" FOREIGN KEY ("practice_test_id") REFERENCES "practice_tests"("practice_test_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "practice_attempts" ADD CONSTRAINT "FK_324ee04ee69829214dffbc7afe5" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "practice_tests" ADD CONSTRAINT "FK_2df0993fae57505c68b3d066d95" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exams" ADD CONSTRAINT "FK_092c1188aefcf72f818482268e0" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exam_levels" ADD CONSTRAINT "FK_fc2e3709bc41f3e6938f4133ed3" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "level_categories" ADD CONSTRAINT "FK_2f8d600ce2aa4c6185e6e25648d" FOREIGN KEY ("level_id") REFERENCES "exam_levels"("level_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "level_questions" ADD CONSTRAINT "FK_18caba3a1b79ff3a287cb97314f" FOREIGN KEY ("level_category_id") REFERENCES "level_categories"("level_category_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "level_questions" ADD CONSTRAINT "FK_9544efb1afc900b5edf0b7f7ec4" FOREIGN KEY ("question_id") REFERENCES "questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "discount_codes" ADD CONSTRAINT "FK_cfbfb4bf3424cab930b5c6c4ffc" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_dcf8450959aadff1b025a2434d7" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_a42df5f11116b3a8db20c0c6392" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_689e4d87550d420d50a869a74ed" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_3693986546ff169f1fc91211ff0" FOREIGN KEY ("discount_id") REFERENCES "discount_codes"("discount_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exam_attempts" ADD CONSTRAINT "FK_0f281a3818a733dc8fdc322ea87" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exam_attempts" ADD CONSTRAINT "FK_898375397defde8d3eb8f7a6d7d" FOREIGN KEY ("level_id") REFERENCES "exam_levels"("level_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" ADD CONSTRAINT "FK_e7848868f4108c4178003e85be5" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("attempt_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" ADD CONSTRAINT "FK_167d2e841510ef6028909f03af8" FOREIGN KEY ("question_id") REFERENCES "questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" ADD CONSTRAINT "FK_f3c0f4e876c92f5f0584fea2d27" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("option_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD CONSTRAINT "FK_435486b970fffc3e33a7450ee97" FOREIGN KEY ("notification_id") REFERENCES "notifications"("notification_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaderboards" ADD CONSTRAINT "FK_2d383d56d6bd6cd72949cc3d09a" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaderboards" ADD CONSTRAINT "FK_18f88b41b429dbdf48791858eb9" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_ec9206067e7e8ef8f2511ae9b01" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("attempt_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_7c5bf104ec5fbc6d177be01af8e" FOREIGN KEY ("student_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_854e22ea050c22d0a703777af5b" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "results" ADD CONSTRAINT "FK_37976280e76b19fcc48e405d075" FOREIGN KEY ("level_id") REFERENCES "exam_levels"("level_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_37976280e76b19fcc48e405d075"`);
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_854e22ea050c22d0a703777af5b"`);
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_7c5bf104ec5fbc6d177be01af8e"`);
        await queryRunner.query(`ALTER TABLE "results" DROP CONSTRAINT "FK_ec9206067e7e8ef8f2511ae9b01"`);
        await queryRunner.query(`ALTER TABLE "leaderboards" DROP CONSTRAINT "FK_18f88b41b429dbdf48791858eb9"`);
        await queryRunner.query(`ALTER TABLE "leaderboards" DROP CONSTRAINT "FK_2d383d56d6bd6cd72949cc3d09a"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "notification_deliveries" DROP CONSTRAINT "FK_435486b970fffc3e33a7450ee97"`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" DROP CONSTRAINT "FK_f3c0f4e876c92f5f0584fea2d27"`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" DROP CONSTRAINT "FK_167d2e841510ef6028909f03af8"`);
        await queryRunner.query(`ALTER TABLE "attempt_questions" DROP CONSTRAINT "FK_e7848868f4108c4178003e85be5"`);
        await queryRunner.query(`ALTER TABLE "exam_attempts" DROP CONSTRAINT "FK_898375397defde8d3eb8f7a6d7d"`);
        await queryRunner.query(`ALTER TABLE "exam_attempts" DROP CONSTRAINT "FK_0f281a3818a733dc8fdc322ea87"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_3693986546ff169f1fc91211ff0"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_689e4d87550d420d50a869a74ed"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_a42df5f11116b3a8db20c0c6392"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_dcf8450959aadff1b025a2434d7"`);
        await queryRunner.query(`ALTER TABLE "discount_codes" DROP CONSTRAINT "FK_cfbfb4bf3424cab930b5c6c4ffc"`);
        await queryRunner.query(`ALTER TABLE "level_questions" DROP CONSTRAINT "FK_9544efb1afc900b5edf0b7f7ec4"`);
        await queryRunner.query(`ALTER TABLE "level_questions" DROP CONSTRAINT "FK_18caba3a1b79ff3a287cb97314f"`);
        await queryRunner.query(`ALTER TABLE "level_categories" DROP CONSTRAINT "FK_2f8d600ce2aa4c6185e6e25648d"`);
        await queryRunner.query(`ALTER TABLE "exam_levels" DROP CONSTRAINT "FK_fc2e3709bc41f3e6938f4133ed3"`);
        await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT "FK_092c1188aefcf72f818482268e0"`);
        await queryRunner.query(`ALTER TABLE "practice_tests" DROP CONSTRAINT "FK_2df0993fae57505c68b3d066d95"`);
        await queryRunner.query(`ALTER TABLE "practice_attempts" DROP CONSTRAINT "FK_324ee04ee69829214dffbc7afe5"`);
        await queryRunner.query(`ALTER TABLE "practice_attempts" DROP CONSTRAINT "FK_0f4a51ba4191cd8257b53cafbb4"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`ALTER TABLE "student_profiles" DROP CONSTRAINT "FK_cef016a0d95e26ae7c0f167ec28"`);
        await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c"`);
        await queryRunner.query(`DROP TABLE "results"`);
        await queryRunner.query(`DROP TABLE "leaderboards"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TABLE "notification_deliveries"`);
        await queryRunner.query(`DROP TABLE "attempt_questions"`);
        await queryRunner.query(`DROP TABLE "exam_attempts"`);
        await queryRunner.query(`DROP TABLE "registrations"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TABLE "discount_codes"`);
        await queryRunner.query(`DROP TABLE "questions"`);
        await queryRunner.query(`DROP TABLE "level_questions"`);
        await queryRunner.query(`DROP TABLE "level_categories"`);
        await queryRunner.query(`DROP TABLE "exam_levels"`);
        await queryRunner.query(`DROP TABLE "exams"`);
        await queryRunner.query(`DROP TABLE "practice_tests"`);
        await queryRunner.query(`DROP TABLE "practice_attempts"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "student_profiles"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "question_options"`);
    }

}
