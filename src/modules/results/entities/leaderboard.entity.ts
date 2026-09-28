import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { Exam } from '../../exams/entities/exam.entity';
import { User } from '../../users/entities/user.entity';

@Entity('leaderboards')
@Unique('uq_leaderboards_exam_student', ['examId', 'studentId'])
export class Leaderboard {
  @PrimaryGeneratedColumn('uuid', { name: 'leaderboard_id' })
  leaderboardId: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'best_score', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  bestScore: number;

  @Column({ name: 'average_score', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  averageScore: number;

  @Column({ type: 'int' })
  rank: number;

  @Column({ name: 'tie_break_value', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  tieBreakValue: number | null;

  @Column({ name: 'published_at', type: 'timestamp' })
  publishedAt: Date;
}
