import 'dotenv/config';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-0000000000';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see apps/api/.env.example)'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default(DEV_JWT_SECRET),
    JWT_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    MOCK_PAYMENT_LATENCY_MS: z.coerce.number().int().min(0).default(300),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    RATE_LIMIT_ENABLED: z.stringbool().default(true),
    // Secure-only session cookie. Defaults to true in production; set false when serving over plain http.
    COOKIE_SECURE: z.stringbool().optional(),
    // Which proxies may set X-Forwarded-For (Express "trust proxy"): false | true | hop count | CIDR/preset list.
    // Default false: the header is ignored, so clients cannot spoof their IP to dodge rate limits.
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((v): boolean | number | string => {
        if (v === 'false') return false;
        if (v === 'true') return true;
        return /^\d+$/.test(v) ? Number(v) : v;
      }),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && (env.JWT_SECRET === DEV_JWT_SECRET || env.JWT_SECRET.includes('change-me'))) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET must be set in production' });
    }
  });

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
