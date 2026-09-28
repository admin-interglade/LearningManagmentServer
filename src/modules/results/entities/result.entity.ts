import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { ExamAttempt } from '../../attempts/entities/exam-attempt.entity';
import { User } from '../../users/entities/user.entity';
import { Exam } from '../../exams/entities/exam.entity';
import { ExamLevel } from '../../exams/entities/exam-level.entity';

@Entity('results')
export class Result {
  @PrimaryGeneratedColumn('uuid', { name: 'result_id' })
  resultId: string;

  @Column({ name: 'attempt_id', type: 'uuid', unique: true })
  attemptId: string;

  @OneToOne(() => ExamAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt: ExamAttempt;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level: ExamLevel;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  score: number;

  @Column({ name: 'marks_earned', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  marksEarned: number;

  @Column({ name: 'marks_lost', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  marksLost: number;

  @Column({ name: 'unattempted_count', type: 'int' })
  unattemptedCount: number;

  @Column({ name: 'average_score', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  averageScore: number;

  @Column({ type: 'int', nullable: true })
  rank: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
