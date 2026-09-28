import { env } from '../../../config/env';
import { CHANNEL, Channel } from '../../../common/constants/statuses';
import { consoleProvider } from './console.provider';
import { dltSmsProvider } from './dlt.provider';
import { twilioEmailProvider, twilioSmsProvider } from './twilio.provider';
import { NotificationProvider } from './provider.interface';

const INDIA = 'IN';

export const resolveProvider = (channel: Channel, countryCode: string): NotificationProvider => {
  if (env.notifications.driver === 'console') return consoleProvider;
  if (channel === CHANNEL.EMAIL) return twilioEmailProvider;
  return countryCode.toUpperCase() === INDIA ? dltSmsProvider : twilioSmsProvider;
};

export const providerByName = (name: string, channel: Channel, countryCode: string): NotificationProvider => {
  const all = [consoleProvider, dltSmsProvider, twilioSmsProvider, twilioEmailProvider];
  return all.find((p) => p.name === name) ?? resolveProvider(channel, countryCode);
};
