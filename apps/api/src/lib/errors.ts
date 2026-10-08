import { Prisma } from '../generated/prisma/client.js';

/** An expected, client-facing error. Serialized as `{ error: { code, message, details } }`. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  validation: (details: unknown) => new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details),
  unauthorized: (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to perform this action') => new AppError(403, 'FORBIDDEN', message),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`),
  insufficientFunds: (required: number, balance: number) =>
    new AppError(402, 'INSUFFICIENT_FUNDS', 'Not enough Gold Coins', {
      required,
      balance,
      shortBy: required - balance,
    }),
  alreadyOwned: () => new AppError(409, 'ALREADY_OWNED', 'You already own this item'),
  idempotencyKeyReused: () =>
    new AppError(
      422,
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different request payload',
    ),
};

/**
 * Name of the unique constraint violated by `err` (e.g. "users_email_key"), or null when `err`
 * is not a unique violation. Constraint names are defined by the migrations, so they are stable.
 */
export function uniqueViolation(err: unknown): string | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const meta = err.meta as
    { target?: string | string[]; driverAdapterError?: { cause?: { constraint?: { index?: string } } } } | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  if (index) return index;
  return Array.isArray(meta?.target) ? meta.target.join('_') : (meta?.target ?? 'unknown');
}

/** True when a Prisma update/delete matched no row (P2025). */
export function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}
