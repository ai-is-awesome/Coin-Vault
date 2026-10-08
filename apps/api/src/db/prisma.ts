import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Builds a Prisma client over node-postgres. A `?schema=` parameter in the URL is honoured
 * (the pg driver ignores it, so it is passed to the adapter explicitly).
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  const adapter = new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

export const prisma = createPrismaClient(env.DATABASE_URL);

export type { PrismaClient };
