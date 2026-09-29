import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { paymentsWebhookRouter } from './modules/payments/payments.routes';
import { errorHandler, notFoundHandler } from './common/error.middleware';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Raw body route must be registered before the JSON parser.
  app.use('/api/payments', paymentsWebhookRouter);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
