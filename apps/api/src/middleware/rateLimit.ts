import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';

const MINUTE = 60_000;

/** Every limit in one place. Exported so tests and docs can refer to the real numbers. */
export const RATE_LIMITS = {
  /** Failed logins per account before it is temporarily locked. */
  failedLoginsPerAccount: { limit: 5, windowMs: 15 * MINUTE },
  /** Login + register attempts per client (IP). */
  authAttemptsPerClient: { limit: 30, windowMs: 15 * MINUTE },
  /** Coin purchase attempts (real-money payments) per user. */
  coinPurchasesPerUser: { limit: 10, windowMs: 10 * MINUTE },
  /** Declined card payments per user: blocks card testing with stolen cards. */
  declinedPaymentsPerUser: { limit: 5, windowMs: 60 * MINUTE },
  /** Product purchase attempts per user. */
  purchasesPerUser: { limit: 30, windowMs: MINUTE },
  /** Admin write operations (catalog changes, balance adjustments, refunds) per admin. */
  adminWritesPerAdmin: { limit: 60, windowMs: MINUTE },
} as const;

function createLimiter(name: string, message: string, options: Partial<Options>): RequestHandler {
  return rateLimit({
    identifier: name,
    standardHeaders: 'draft-8', // RateLimit + RateLimit-Policy headers; Retry-After on 429
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : undefined;
      res.status(429).json({ error: { code: 'RATE_LIMITED', message, details: { retryAfterSeconds } } });
    },
    ...options,
  });
}

function normalizedEmail(req: Request): string {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Options for limits on authenticated writes. Keyed by user id - reliable even when many users share
 * an IP behind the web proxy, and impossible to spoof. Reads are never limited, and anonymous requests
 * are skipped (the route rejects them with 401 anyway).
 */
const perUserWrites = {
  keyGenerator: (req: Request) => `user:${req.user?.id}`,
  skip: (req: Request) => !req.user || req.method === 'GET',
} satisfies Partial<Options>;

const passThrough: RequestHandler = (_req, _res, next) => next();

/**
 * All rate limiters, created per app instance so each has its own in-memory store. With several API
 * instances, use a shared store (e.g. rate-limit-redis) so limits apply across all of them.
 *
 * Auth endpoints get two independent limits:
 *  - per ACCOUNT (email), counting only failed logins: stops password guessing against one account
 *    no matter how many IPs the attacker rotates through, and is immune to header spoofing;
 *  - per CLIENT (IP), counting every login/register attempt: slows credential stuffing across many
 *    accounts and sign-up spam. Client IPs are only as trustworthy as the `TRUST_PROXY` setting.
 */
export function createRateLimiters({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return {
      auth: { perClient: passThrough, perAccount: passThrough },
      coinPurchases: [passThrough],
      purchases: passThrough,
      adminWrites: passThrough,
    };
  }

  return {
    auth: {
      perClient: createLimiter('auth-client', 'Too many attempts from this device. Please try again later.', {
        ...RATE_LIMITS.authAttemptsPerClient,
        keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
      }),
      perAccount: createLimiter(
        'auth-account',
        'Too many failed sign-in attempts for this account. Please wait a few minutes and try again.',
        {
          ...RATE_LIMITS.failedLoginsPerAccount,
          skipSuccessfulRequests: true, // only failed attempts (4xx/5xx) count
          keyGenerator: (req) => `account:${normalizedEmail(req)}`,
        },
      ),
    },

    coinPurchases: [
      createLimiter('coin-purchases', 'Too many coin purchases in a short time. Please wait a few minutes.', {
        ...RATE_LIMITS.coinPurchasesPerUser,
        ...perUserWrites,
      }),
      createLimiter(
        'declined-payments',
        'Too many declined payments. For your security, card payments are paused for a while.',
        {
          ...RATE_LIMITS.declinedPaymentsPerUser,
          ...perUserWrites,
          skipSuccessfulRequests: true,
          requestWasSuccessful: (_req, res) => res.statusCode !== 402, // only declines count
        },
      ),
    ],

    purchases: createLimiter('purchases', 'You are buying too fast. Please slow down and try again shortly.', {
      ...RATE_LIMITS.purchasesPerUser,
      ...perUserWrites,
    }),

    adminWrites: createLimiter('admin-writes', 'Too many admin changes in a short time. Please slow down.', {
      ...RATE_LIMITS.adminWritesPerAdmin,
      ...perUserWrites,
    }),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
export type AuthRateLimiters = RateLimiters['auth'];
