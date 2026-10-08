import 'dotenv/config';
import { execSync } from 'node:child_process';
import { resolveTestDirectUrl } from './testDatabase.js';

/** Applies migrations to the test database/schema once before the whole run. */
export default function setup() {
  const url = resolveTestDirectUrl();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
}
