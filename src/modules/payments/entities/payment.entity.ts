import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/utils/decimal.transformer';
import { Registration } from '../../registrations/entities/registration.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid', { name: 'payment_id' })
  paymentId: string;

  @Column({ name: 'registration_id', type: 'uuid' })
  registrationId: string;

  @ManyToOne(() => Registration, (registration) => registration.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;

  @Column({ type: 'varchar', length: 50, default: 'razorpay' })
  provider: string;

  @Column({ name: 'order_id', type: 'varchar', length: 255, unique: true })
  orderId: string;

  @Column({ name: 'payment_id_external', type: 'varchar', length: 255, nullable: true })
  paymentIdExternal: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  signature: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
