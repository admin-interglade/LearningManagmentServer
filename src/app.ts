import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './common/middlewares/error.middleware';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1); // behind the load balancer
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(
    rateLimit({
      windowMs: env.rateLimit.windowMinutes * 60 * 1000,
      limit: env.rateLimit.maxRequests,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.use(env.apiPrefix, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
