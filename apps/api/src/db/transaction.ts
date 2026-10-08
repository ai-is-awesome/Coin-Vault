import { AppError } from '../lib/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type Tx = Prisma.TransactionClient;

const MAX_ATTEMPTS = 3;

/**
 * Runs `fn` in an interactive transaction (READ COMMITTED). Correctness does not depend on the
 * isolation level: balance changes are single conditional UPDATEs that take a row lock and
 * re-check their WHERE clause, and duplicates are stopped by unique constraints.
 *
 * Deadlocks / write conflicts (P2034) are retried, so `fn` must not have side effects outside the DB.
 */
export async function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 5_000, timeout: 15_000 });
    } catch (err) {
      const retryable = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (!retryable) throw err;
      if (attempt >= MAX_ATTEMPTS) {
        throw new AppError(503, 'TRY_AGAIN', 'The request conflicted with a concurrent update, please retry');
      }
    }
  }
}
