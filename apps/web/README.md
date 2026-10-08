# Coin Vault - web

Next.js 16 (App Router) frontend for Coin Vault. See the [root README](../../README.md) for setup.

- `npm run dev -w apps/web` starts the dev server on http://localhost:3000.
- `/api/*` is proxied to the Express API (`API_URL`, default `http://127.0.0.1:4000`) via `rewrites` in `next.config.ts`, so the session cookie is first-party.
- Pages are thin server components (metadata) that render client views from `src/views/`; data fetching uses TanStack Query hooks in `src/lib/queries.ts`.
