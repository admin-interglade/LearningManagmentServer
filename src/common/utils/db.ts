import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../../config/data-source';

// Repositories accept an optional manager so services can run them inside a transaction
export const repo = <T extends ObjectLiteral>(entity: EntityTarget<T>, manager?: EntityManager) =>
  (manager ?? AppDataSource.manager).getRepository(entity);

export const transaction = <T>(work: (manager: EntityManager) => Promise<T>) => AppDataSource.transaction(work);

export const isUniqueViolation = (err: unknown) =>
  (err as { driverError?: { code?: string } })?.driverError?.code === '23505';
