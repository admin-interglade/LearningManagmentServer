import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import { Exam } from '../../exams/entities/exam.entity';
import { DiscountCode } from '../../discounts/entities/discount-code.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('registrations')
@Unique('uq_registrations_student_exam', ['studentId', 'examId'])
export class Registration {
  @PrimaryGeneratedColumn('uuid', { name: 'registration_id' })
  registrationId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => Exam, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'discount_id', type: 'uuid', nullable: true })
  discountId: string | null;

  @ManyToOne(() => DiscountCode, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'discount_id' })
  discount: DiscountCode | null;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  grossAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  discountAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  netAmount: number;

  @Column({ name: 'payment_status', type: 'varchar', length: 30 })
  paymentStatus: string;

  @Column({ name: 'registration_status', type: 'varchar', length: 30 })
  registrationStatus: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => Payment, (payment) => payment.registration)
  payments: Payment[];
}
