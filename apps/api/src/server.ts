import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { logger } from './lib/logger.js';

await prisma.$connect();

if (env.NODE_ENV === 'production' && env.TRUST_PROXY === false) {
  logger.warn(
    'TRUST_PROXY is not set: behind a reverse proxy every client shares one IP for rate limiting. ' +
      'Set TRUST_PROXY to the number of proxies that append X-Forwarded-For (see README).',
  );
}

const server = createApp().listen(env.PORT, () => {
  logger.info(`Coin Vault API listening on http://localhost:${env.PORT}/api`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever on stuck connections
  // Stop accepting connections and let in-flight requests (and their transactions) finish first.
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeIdleConnections();
  });
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
