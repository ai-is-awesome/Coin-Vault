/**
 * Tests run against DATABASE_URL_TEST, or by default against an isolated `coinvault_test` schema
 * inside DATABASE_URL's database - so a single Postgres (local, Docker or hosted) is enough.
 */
export const DEFAULT_TEST_SCHEMA = 'coinvault_test';

function withTestSchema(base: string): string {
  const url = new URL(base);
  url.searchParams.set('schema', DEFAULT_TEST_SCHEMA);
  return url.toString();
}

export function resolveTestDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Tests need a Postgres database: set DATABASE_URL (tests use its "coinvault_test" schema) or DATABASE_URL_TEST',
    );
  }
  return withTestSchema(base);
}

/** The URL the Prisma CLI should use to migrate the test schema (DIRECT_URL when a pooler is in front). */
export function resolveTestDirectUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const direct = process.env.DIRECT_URL;
  if (!direct) return resolveTestDatabaseUrl();
  assertSameDatabase(resolveTestDatabaseUrl(), direct);
  return withTestSchema(direct);
}

/**
 * DATABASE_URL and DIRECT_URL must be two routes to the same database, otherwise the tests would
 * migrate one database and run against another (e.g. DATABASE_URL overridden in the shell while
 * DIRECT_URL still comes from .env). Pooled and direct URLs differ in host/port, never in user or db name.
 */
function assertSameDatabase(databaseUrl: string, directUrl: string) {
  const [a, b] = [new URL(databaseUrl), new URL(directUrl)];
  if (a.username !== b.username || a.pathname !== b.pathname) {
    throw new Error(
      `DATABASE_URL (${a.username}@…${a.pathname}) and DIRECT_URL (${b.username}@…${b.pathname}) point at ` +
        'different databases. Fix them, or set DATABASE_URL_TEST to run the tests against a specific database.',
    );
  }
}

export function testSchema(url: string): string {
  return new URL(url).searchParams.get('schema') ?? 'public';
}
