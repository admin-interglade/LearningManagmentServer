import { z } from 'zod';
import { NOTIFICATION_EVENTS } from './notification.templates';

export const raiseEventSchema = z.object({
  user_id: z.uuid(),
  event_type: z.enum(NOTIFICATION_EVENTS),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type RaiseEventBody = z.infer<typeof raiseEventSchema>;
