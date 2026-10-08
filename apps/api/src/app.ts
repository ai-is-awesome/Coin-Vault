import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  /** Defaults to RATE_LIMIT_ENABLED. Each app instance gets its own limiter state. */
  rateLimit?: boolean;
}

export function createApp({ rateLimit = env.RATE_LIMIT_ENABLED }: AppOptions = {}) {
  const app = express();

  // Only proxies listed in TRUST_PROXY may set the client IP via X-Forwarded-For (see README).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter({ limiters: createRateLimiters({ enabled: rateLimit }) }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
