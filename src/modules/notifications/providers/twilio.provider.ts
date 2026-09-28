import { env } from '../../../config/env';
import { NotificationProvider, OutgoingMessage } from './provider.interface';

const { twilio, sendgridApiKey, mailFrom } = env.notifications;

// SMS outside India via Twilio Programmable Messaging
export const twilioSmsProvider: NotificationProvider = {
  name: 'twilio',
  async send(message: OutgoingMessage) {
    if (!twilio.accountSid || !twilio.authToken || !twilio.fromNumber) throw new Error('Twilio SMS is not configured');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: message.to, From: twilio.fromNumber, Body: message.body }),
    });
    const data = (await response.json()) as { sid?: string; message?: string };
    if (!response.ok) throw new Error(`Twilio error ${response.status}: ${data.message ?? 'unknown'}`);
    return { externalMessageId: data.sid ?? null };
  },
};

// Transactional email via Twilio SendGrid
export const twilioEmailProvider: NotificationProvider = {
  name: 'twilio_sendgrid',
  async send(message: OutgoingMessage) {
    if (!sendgridApiKey) throw new Error('SendGrid email is not configured');
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sendgridApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: mailFrom },
        subject: message.subject,
        content: [{ type: 'text/plain', value: message.body }],
      }),
    });
    if (!response.ok) throw new Error(`SendGrid error ${response.status}: ${await response.text()}`);
    return { externalMessageId: response.headers.get('x-message-id') };
  },
};
