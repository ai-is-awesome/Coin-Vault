import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Rate limiting is off by default in tests (all requests share one IP); rateLimit.test.ts turns it on.
    env: {
      NODE_ENV: 'test',
      MOCK_PAYMENT_LATENCY_MS: '0',
      BCRYPT_ROUNDS: '4',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_ENABLED: 'false',
    },
    // All suites share one test schema; run files sequentially so cleanup between tests is deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
