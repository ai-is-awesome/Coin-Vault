import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError, Errors } from './errors.js';

function parseWith<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw Errors.validation(result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}

// Express 5 makes req.query read-only, so validated input is returned rather than written back.
export const parseBody = <S extends z.ZodType>(schema: S, req: Request) => parseWith(schema, req.body ?? {});
export const parseQuery = <S extends z.ZodType>(schema: S, req: Request) => parseWith(schema, req.query);
export const parseParams = <S extends z.ZodType>(schema: S, req: Request) => parseWith(schema, req.params);

export const IdParams = z.object({ id: z.uuid('Must be a valid id') });

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** The authenticated user, or a 401. */
export function requireUser(req: Request) {
  if (!req.user) throw Errors.unauthorized();
  return req.user;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,128}$/;

/** Money-moving POSTs require an `Idempotency-Key` header so client retries can never double-charge. */
export function requireIdempotencyKey(req: Request): string {
  const key = req.get('Idempotency-Key');
  if (!key) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'The Idempotency-Key header is required for this request');
  }
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key must be 8-128 characters of [A-Za-z0-9_.:-]');
  }
  return key;
}

/** 201 for a newly processed request, 200 + `Idempotent-Replayed: true` for a replay. */
export function sendIdempotent(res: Response, replayed: boolean, body: unknown) {
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(body);
}
