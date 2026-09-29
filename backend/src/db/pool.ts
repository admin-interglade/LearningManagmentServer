import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { env } from '../config/env';

// Return NUMERIC as JS numbers (money values are small) and bigint counts as numbers.
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
// Keep DATE columns as 'YYYY-MM-DD' strings to avoid timezone shifts.
types.setTypeParser(types.builtins.DATE, (v) => v);

export const pool = new Pool({ connectionString: env.databaseUrl, max: 10 });

export type Queryable = Pick<PoolClient, 'query'>;

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Queryable = pool) {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Queryable = pool) {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
