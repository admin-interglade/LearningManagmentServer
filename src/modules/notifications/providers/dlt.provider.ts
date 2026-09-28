import { env } from '../../../config/env';
import { NotificationProvider, OutgoingMessage } from './provider.interface';

const { dlt } = env.notifications;

// India-bound SMS must go through a DLT-registered gateway. The gateway is not finalized yet,
// so this posts a generic JSON payload; adapt the request shape once the vendor is chosen.
export const dltSmsProvider: NotificationProvider = {
  name: 'india_dlt',
  async send(message: OutgoingMessage) {
    if (!dlt.apiUrl || !dlt.apiKey) throw new Error('India DLT SMS gateway is not configured');
    const response = await fetch(dlt.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dlt.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: dlt.senderId, to: message.to, message: message.body }),
    });
    if (!response.ok) throw new Error(`DLT gateway error ${response.status}: ${await response.text()}`);
    const data = (await response.json().catch(() => ({}))) as { id?: string; message_id?: string };
    return { externalMessageId: data.message_id ?? data.id ?? null };
  },
};
