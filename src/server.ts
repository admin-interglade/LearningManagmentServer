import 'reflect-metadata';
import { env } from './config/env';
import { AppDataSource } from './config/data-source';
import { createApp } from './app';

const bootstrap = async () => {
  await AppDataSource.initialize();
  console.log(`Database connected (${env.db.url ? new URL(env.db.url).host : `${env.db.host}:${env.db.port}`})`);

  const server = createApp().listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}${env.apiPrefix}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      AppDataSource.destroy().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
