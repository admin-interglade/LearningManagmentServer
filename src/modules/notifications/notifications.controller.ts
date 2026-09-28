import { Request, Response } from 'express';
import { created, ok } from '../../common/utils/response';
import { notificationsService } from './notifications.service';
import { RaiseEventBody } from './notifications.validation';

export const notificationsController = {
  async raiseEvent(req: Request, res: Response) {
    const body = req.body as RaiseEventBody;
    const notification = await notificationsService.raiseEvent(
      { userId: body.user_id, eventType: body.event_type, payload: body.payload },
      { waitForDelivery: true },
    );
    created(res, notification, 'Notification event raised');
  },

  async retry(req: Request, res: Response) {
    ok(res, await notificationsService.retry(req.params.notificationId as string), 'Notification retried');
  },
};
