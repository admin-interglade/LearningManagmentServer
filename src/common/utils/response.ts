import { Response } from 'express';

const toSnake = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Entities are camelCase in code; the API speaks snake_case like the DB schema
const OPAQUE_KEYS = new Set(['payloadJson', 'payload_json']);

export const toSnakeCase = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [toSnake(k), OPAQUE_KEYS.has(k) ? v : toSnakeCase(v)]),
  );
};

export const ok = (res: Response, data: unknown, message = 'OK') =>
  res.status(200).json({ success: true, message, data: toSnakeCase(data) });

export const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data: toSnakeCase(data) });
