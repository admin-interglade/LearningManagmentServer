import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuestionOption } from './question-option.entity';
import { LevelQuestion } from './level-question.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid', { name: 'question_id' })
  questionId: string;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ type: 'varchar', length: 20 })
  complexity: string;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => QuestionOption, (option) => option.question, { cascade: ['insert'] })
  options: QuestionOption[];

  @OneToMany(() => LevelQuestion, (lq) => lq.question)
  levelQuestions: LevelQuestion[];
}
