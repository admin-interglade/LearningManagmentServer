import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid', { name: 'delivery_id' })
  deliveryId: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, (notification) => notification.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  // SMS / EMAIL
  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ name: 'external_message_id', type: 'varchar', length: 255, nullable: true })
  externalMessageId: string | null;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;
}
