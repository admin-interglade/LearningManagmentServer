import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { Exam } from '../../exams/entities/exam.entity';

@Entity('discount_codes')
export class DiscountCode {
  @PrimaryGeneratedColumn('uuid', { name: 'discount_id' })
  discountId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  // percentage / flat
  @Column({ name: 'discount_type', type: 'varchar', length: 20 })
  discountType: string;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  discountValue: number;

  @Column({ name: 'valid_from', type: 'timestamp' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'timestamp' })
  validTo: Date;

  @Column({ name: 'usage_limit', type: 'int' })
  usageLimit: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'max_discount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  maxDiscount: number | null;

  @Column({ name: 'exam_id', type: 'uuid', nullable: true })
  examId: string | null;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
