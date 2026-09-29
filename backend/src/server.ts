import { env } from './config/env';
import { createApp } from './app';
import { pool } from './db/pool';

const server = createApp().listen(env.port, () => {
  console.log(`Interglade Talent API listening on http://localhost:${env.port}`);
});

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
