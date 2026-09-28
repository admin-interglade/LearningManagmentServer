import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import { PracticeTest } from './practice-test.entity';

@Entity('practice_attempts')
export class PracticeAttempt {
  @PrimaryGeneratedColumn('uuid', { name: 'practice_attempt_id' })
  practiceAttemptId: string;

  @Column({ name: 'practice_test_id', type: 'uuid' })
  practiceTestId: string;

  @ManyToOne(() => PracticeTest, (test) => test.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'practice_test_id' })
  practiceTest: PracticeTest;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  score: number | null;

  @Column({ type: 'varchar', length: 30 })
  status: string;
}
