import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { LevelCategory } from '../../exams/entities/level-category.entity';
import { Question } from './question.entity';

@Entity('level_questions')
@Unique('uq_level_questions_category_question', ['levelCategoryId', 'questionId'])
export class LevelQuestion {
  @PrimaryGeneratedColumn('uuid', { name: 'level_question_id' })
  levelQuestionId: string;

  @Column({ name: 'level_category_id', type: 'uuid' })
  levelCategoryId: string;

  @ManyToOne(() => LevelCategory, (category) => category.levelQuestions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_category_id' })
  levelCategory: LevelCategory;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => Question, (question) => question.levelQuestions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1, transformer: decimalTransformer })
  weightage: number;
}
