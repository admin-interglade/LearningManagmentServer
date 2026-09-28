import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import { env } from './env';

export const AppDataSource = new DataSource({
  type: 'postgres',
  uuidExtension: 'pgcrypto',
  ...(env.db.url
    ? { url: env.db.url }
    : {
        host: env.db.host,
        port: env.db.port,
        username: env.db.user,
        password: env.db.password,
        database: env.db.name,
      }),
  ssl: env.db.ssl || /sslmode=(require|verify-full|verify-ca)/.test(env.db.url) ? { rejectUnauthorized: true } : false,
  synchronize: env.db.synchronize,
  logging: env.db.logging,
  entities: [path.join(__dirname, '../modules/**/entities/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '../database/migrations/*.{ts,js}')],
});
