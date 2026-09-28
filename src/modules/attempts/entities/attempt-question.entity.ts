import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Question } from '../../questions/entities/question.entity';
import { QuestionOption } from '../../questions/entities/question-option.entity';
import { ExamAttempt } from './exam-attempt.entity';

@Entity('attempt_questions')
export class AttemptQuestion {
  @PrimaryGeneratedColumn('uuid', { name: 'attempt_question_id' })
  attemptQuestionId: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => ExamAttempt, (attempt) => attempt.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt: ExamAttempt;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @Column({ name: 'question_order', type: 'int' })
  questionOrder: number;

  @Column({ name: 'selected_option_id', type: 'uuid', nullable: true })
  selectedOptionId: string | null;

  @ManyToOne(() => QuestionOption, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'selected_option_id' })
  selectedOption: QuestionOption | null;

  @Column({ name: 'is_skipped', type: 'boolean', default: false })
  isSkipped: boolean;

  @Column({ name: 'is_flagged', type: 'boolean', default: false })
  isFlagged: boolean;

  @Column({ name: 'answered_at', type: 'timestamp', nullable: true })
  answeredAt: Date | null;
}
