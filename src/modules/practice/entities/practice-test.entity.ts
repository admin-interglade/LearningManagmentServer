import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Exam } from '../../exams/entities/exam.entity';
import { PracticeAttempt } from './practice-attempt.entity';

@Entity('practice_tests')
export class PracticeTest {
  @PrimaryGeneratedColumn('uuid', { name: 'practice_test_id' })
  practiceTestId: string;

  @Column({ name: 'exam_id', type: 'uuid', unique: true })
  examId: string;

  @OneToOne(() => Exam, (exam) => exam.practiceTest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'attempts_allowed', type: 'int' })
  attemptsAllowed: number;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'question_count', type: 'int' })
  questionCount: number;

  @OneToMany(() => PracticeAttempt, (attempt) => attempt.practiceTest)
  attempts: PracticeAttempt[];
}
