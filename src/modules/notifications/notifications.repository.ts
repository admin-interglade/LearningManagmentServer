import { EntityManager } from 'typeorm';
import { repo } from '../../common/utils/db';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';

export const notificationsRepository = {
  create: (data: Partial<Notification>, manager?: EntityManager) =>
    repo(Notification, manager).save(repo(Notification, manager).create(data)),

  createDelivery: (data: Partial<NotificationDelivery>, manager?: EntityManager) =>
    repo(NotificationDelivery, manager).save(repo(NotificationDelivery, manager).create(data)),

  findById: (notificationId: string) =>
    repo(Notification).findOne({
      where: { notificationId },
      relations: { deliveries: true, user: true },
    }),

  saveDelivery: (delivery: NotificationDelivery) => repo(NotificationDelivery).save(delivery),

  updateStatus: (notificationId: string, status: string) => repo(Notification).update({ notificationId }, { status }),

  countFailedDeliveries: () => repo(NotificationDelivery).count({ where: { status: 'failed' } }),
};
