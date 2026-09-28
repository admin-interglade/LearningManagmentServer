import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { Exam } from './exam.entity';
import { LevelCategory } from './level-category.entity';

@Entity('exam_levels')
@Unique('uq_exam_levels_exam_level_number', ['examId', 'levelNumber'])
export class ExamLevel {
  @PrimaryGeneratedColumn('uuid', { name: 'level_id' })
  levelId: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => Exam, (exam) => exam.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'level_number', type: 'int' })
  levelNumber: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'question_count', type: 'int' })
  questionCount: number;

  @Column({ name: 'max_score', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  maxScore: number;

  @Column({ name: 'attempts_allowed', type: 'int', default: 1 })
  attemptsAllowed: number;

  @OneToMany(() => LevelCategory, (category) => category.level)
  categories: LevelCategory[];
}
