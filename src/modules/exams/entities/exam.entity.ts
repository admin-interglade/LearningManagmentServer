import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import { ExamLevel } from './exam-level.entity';
import { PracticeTest } from '../../practice/entities/practice-test.entity';

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid', { name: 'exam_id' })
  examId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  syllabus: string | null;

  @Column({ name: 'registration_start', type: 'timestamp' })
  registrationStart: Date;

  @Column({ name: 'registration_end', type: 'timestamp' })
  registrationEnd: Date;

  @Column({ name: 'exam_start', type: 'timestamp' })
  examStart: Date;

  @Column({ name: 'exam_end', type: 'timestamp' })
  examEnd: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  fee: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'text', nullable: true })
  award: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => ExamLevel, (level) => level.exam)
  levels: ExamLevel[];

  @OneToOne(() => PracticeTest, (practice) => practice.exam)
  practiceTest: PracticeTest | null;
}
