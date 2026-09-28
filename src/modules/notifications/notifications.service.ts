import { AppError } from '../../common/errors/app-error';
import { CHANNEL, Channel, DELIVERY_STATUS, NOTIFICATION_STATUS } from '../../common/constants/statuses';
import { env } from '../../config/env';
import { usersRepository } from '../users/users.repository';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { notificationsRepository } from './notifications.repository';
import { NotificationEvent, TEMPLATES } from './notification.templates';
import { providerByName, resolveProvider } from './providers';

interface RaiseEventInput {
  userId: string;
  eventType: NotificationEvent;
  payload?: Record<string, unknown>;
}

const recipientFor = (notification: Notification, channel: string) =>
  channel === CHANNEL.EMAIL ? notification.user.email : notification.user.mobile;

const attemptDelivery = async (notification: Notification, delivery: NotificationDelivery) => {
  const template = TEMPLATES[notification.eventType as NotificationEvent] ?? TEMPLATES.CUSTOM;
  const payload = notification.payloadJson ?? {};
  const to = recipientFor(notification, delivery.channel);
  const provider = providerByName(delivery.provider, delivery.channel as Channel, notification.countryCode);
  try {
    if (!to) throw new Error(`User has no ${delivery.channel === CHANNEL.EMAIL ? 'email' : 'mobile'} on record`);
    const { externalMessageId } = await provider.send({
      channel: delivery.channel as Channel,
      to,
      subject: template.subject(payload),
      body: template.body(payload),
    });
    delivery.status = DELIVERY_STATUS.SENT;
    delivery.externalMessageId = externalMessageId;
    delivery.deliveredAt = new Date();
    delivery.failureReason = null;
  } catch (err) {
    delivery.status = DELIVERY_STATUS.FAILED;
    delivery.failureReason = err instanceof Error ? err.message : String(err);
  }
  return notificationsRepository.saveDelivery(delivery);
};

const rollUpStatus = (deliveries: NotificationDelivery[]) => {
  const sent = deliveries.filter((d) => d.status === DELIVERY_STATUS.SENT).length;
  if (deliveries.length === 0 || sent === 0) return NOTIFICATION_STATUS.FAILED;
  return sent === deliveries.length ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.PARTIAL;
};

const dispatch = async (notification: Notification, deliveries: NotificationDelivery[]) => {
  await Promise.all(deliveries.map((d) => attemptDelivery(notification, d)));
  notification.status = rollUpStatus(deliveries);
  await notificationsRepository.updateStatus(notification.notificationId, notification.status);
  return notification;
};

const raiseEvent = async ({ userId, eventType, payload = {} }: RaiseEventInput, { waitForDelivery = false } = {}) => {
  const user = await usersRepository.findById(userId);
  if (!user) throw AppError.notFound('User not found');

  const notification = await notificationsRepository.create({
    userId,
    eventType,
    templateCode: TEMPLATES[eventType].code,
    countryCode: user.countryCode,
    payloadJson: payload,
    status: NOTIFICATION_STATUS.PENDING,
  });
  notification.user = user;

  const channels: Channel[] = [];
  if (user.email) channels.push(CHANNEL.EMAIL);
  if (user.mobile) channels.push(CHANNEL.SMS);

  const deliveries = await Promise.all(
    channels.map((channel) =>
      notificationsRepository.createDelivery({
        notificationId: notification.notificationId,
        channel,
        provider: resolveProvider(channel, user.countryCode).name,
        status: DELIVERY_STATUS.PENDING,
        retryCount: 0,
      }),
    ),
  );

  const run = dispatch(notification, deliveries);
  if (waitForDelivery) return run.then(() => ({ ...notification, deliveries }));

  run.catch((err) => console.error('Notification dispatch failed', err));
  return { ...notification, deliveries };
};

// Fire-and-forget helper for business flows: a notification failure must never break the main request
const notifySafely = (input: RaiseEventInput) => {
  raiseEvent(input).catch((err) => console.error(`Failed to raise ${input.eventType} notification`, err));
};

const retry = async (notificationId: string) => {
  const notification = await notificationsRepository.findById(notificationId);
  if (!notification) throw AppError.notFound('Notification not found');

  const retryable = notification.deliveries.filter(
    (d) => d.status === DELIVERY_STATUS.FAILED && d.retryCount < env.notifications.maxRetries,
  );
  if (retryable.length === 0) {
    throw AppError.conflict('No failed deliveries eligible for retry');
  }

  for (const delivery of retryable) delivery.retryCount += 1;
  await Promise.all(retryable.map((d) => attemptDelivery(notification, d)));

  notification.status = rollUpStatus(notification.deliveries);
  await notificationsRepository.updateStatus(notificationId, notification.status);

  const { user: _user, ...rest } = notification;
  return rest;
};

export const notificationsService = { raiseEvent, notifySafely, retry };
