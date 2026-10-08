import 'dotenv/config';
import { afterAll, beforeEach } from 'vitest';
import { resolveTestDatabaseUrl, testSchema } from './testDatabase.js';

// Must happen before any application module reads the environment.
const testUrl = resolveTestDatabaseUrl();
process.env.DATABASE_URL = testUrl;

const schema = testSchema(testUrl);
if (schema === 'public' && !process.env.DATABASE_URL_TEST) {
  throw new Error('Refusing to run tests against the "public" schema');
}

const { prisma } = await import('../src/db/prisma.js');

const TABLES = [
  'ledger_entries',
  'inventory_items',
  'purchases',
  'payment_orders',
  'wallets',
  'users',
  'products',
  'coin_packages',
];

beforeEach(async () => {
  // TRUNCATE bypasses the append-only row trigger on ledger_entries (it only blocks UPDATE/DELETE).
  const qualified = TABLES.map((t) => `"${schema}"."${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualified} CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
