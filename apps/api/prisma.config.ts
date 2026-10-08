import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // The CLI (migrate, studio) needs a direct or session-mode connection: migrations take advisory
    // locks, which transaction-mode poolers (e.g. Supabase port 6543) don't support. The running app
    // uses DATABASE_URL, which may be pooled. Read lazily so `prisma generate` works without a database.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
