import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Registration } from '../../registrations/entities/registration.entity';
import { ExamLevel } from '../../exams/entities/exam-level.entity';
import { AttemptQuestion } from './attempt-question.entity';

@Entity('exam_attempts')
@Unique('uq_exam_attempts_registration_level_number', ['registrationId', 'levelId', 'attemptNumber'])
export class ExamAttempt {
  @PrimaryGeneratedColumn('uuid', { name: 'attempt_id' })
  attemptId: string;

  @Column({ name: 'registration_id', type: 'uuid' })
  registrationId: string;

  @ManyToOne(() => Registration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level: ExamLevel;

  @Column({ name: 'attempt_number', type: 'int' })
  attemptNumber: number;

  @Column({ name: 'generation_seed', type: 'bigint' })
  generationSeed: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'auto_submitted', type: 'boolean', default: false })
  autoSubmitted: boolean;

  @OneToMany(() => AttemptQuestion, (aq) => aq.attempt)
  questions: AttemptQuestion[];
}
