import crypto from 'crypto';
import { NotificationProvider, OutgoingMessage } from './provider.interface';

// Development driver: logs instead of sending
export const consoleProvider: NotificationProvider = {
  name: 'console',
  async send(message: OutgoingMessage) {
    console.log(`[notification:${message.channel}] to=${message.to} subject="${message.subject}"\n${message.body}`);
    return { externalMessageId: `console_${crypto.randomUUID()}` };
  },
};
