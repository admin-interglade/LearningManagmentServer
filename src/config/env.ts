import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const str = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env variable: ${key}`);
  return value;
};
const num = (key: string, fallback: number): number => {
  const value = process.env[key];
  return value ? Number(value) : fallback;
};
const bool = (key: string, fallback: boolean): boolean => {
  const value = process.env[key];
  return value ? value === 'true' : fallback;
};

const nodeEnv = str('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: num('PORT', 5050),
  apiPrefix: str('API_PREFIX', '/api'),
  corsOrigins: str('CORS_ORIGINS', 'http://localhost:3000').split(',').map((o) => o.trim()),
  clientUrl: str('CLIENT_URL', 'http://localhost:3000'),

  db: {
    // Takes precedence over the individual DB_* settings (e.g. Neon/managed Postgres connection string)
    url: str('DATABASE_URL', ''),
    host: str('DB_HOST', 'localhost'),
    port: num('DB_PORT', 5432),
    name: str('DB_NAME', 'online_examination'),
    user: str('DB_USER', 'postgres'),
    password: str('DB_PASSWORD', ''),
    ssl: bool('DB_SSL', false),
    logging: bool('DB_LOGGING', false),
    synchronize: bool('DB_SYNCHRONIZE', false),
  },

  jwt: {
    accessSecret: str('JWT_ACCESS_SECRET'),
    accessExpiresIn: str('JWT_ACCESS_EXPIRES_IN', '1d'),
    resetSecret: str('JWT_RESET_SECRET'),
    resetExpiresIn: str('JWT_RESET_EXPIRES_IN', '15m'),
  },
  bcryptSaltRounds: num('BCRYPT_SALT_ROUNDS', 12),

  rateLimit: {
    windowMinutes: num('RATE_LIMIT_WINDOW_MINUTES', 15),
    maxRequests: num('RATE_LIMIT_MAX_REQUESTS', 300),
    authMaxRequests: num('AUTH_RATE_LIMIT_MAX_REQUESTS', 20),
  },

  razorpay: {
    keyId: str('RAZORPAY_KEY_ID', ''),
    keySecret: str('RAZORPAY_KEY_SECRET', ''),
    mock: bool('RAZORPAY_MOCK', false),
  },
  defaultCurrency: str('DEFAULT_CURRENCY', 'INR'),

  notifications: {
    driver: str('NOTIFICATION_DRIVER', 'console'),
    maxRetries: num('NOTIFICATION_MAX_RETRIES', 3),
    twilio: {
      accountSid: str('TWILIO_ACCOUNT_SID', ''),
      authToken: str('TWILIO_AUTH_TOKEN', ''),
      fromNumber: str('TWILIO_FROM_NUMBER', ''),
    },
    sendgridApiKey: str('SENDGRID_API_KEY', ''),
    mailFrom: str('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
    dlt: {
      apiUrl: str('DLT_API_URL', ''),
      apiKey: str('DLT_API_KEY', ''),
      senderId: str('DLT_SENDER_ID', ''),
    },
  },

  seed: {
    adminEmail: str('SEED_ADMIN_EMAIL', 'admin@example.com'),
    adminPassword: str('SEED_ADMIN_PASSWORD', ''),
  },
};

if (env.isProduction && env.razorpay.mock) {
  throw new Error('RAZORPAY_MOCK must not be enabled in production');
}
