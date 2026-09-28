import { Channel } from '../../../common/constants/statuses';

export interface OutgoingMessage {
  channel: Channel;
  to: string;
  subject: string;
  body: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<{ externalMessageId: string | null }>;
}
