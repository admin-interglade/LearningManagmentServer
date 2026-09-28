import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { ExamLevel } from './exam-level.entity';
import { LevelQuestion } from '../../questions/entities/level-question.entity';

@Entity('level_categories')
export class LevelCategory {
  @PrimaryGeneratedColumn('uuid', { name: 'level_category_id' })
  levelCategoryId: string;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamLevel, (level) => level.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level: ExamLevel;

  @Column({ name: 'category_name', type: 'varchar', length: 255 })
  categoryName: string;

  // low / medium / high
  @Column({ type: 'varchar', length: 20 })
  complexity: string;

  @Column({ name: 'marks_per_question', type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  marksPerQuestion: number;

  @Column({ name: 'negative_marking', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  negativeMarking: number;

  @OneToMany(() => LevelQuestion, (lq) => lq.levelCategory)
  levelQuestions: LevelQuestion[];
}
