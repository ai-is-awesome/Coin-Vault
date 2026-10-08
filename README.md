# Coin Vault

A virtual-currency platform for a gaming store. Players buy **Gold Coins** with real money (payment is mocked), and Gold Coins are the only currency accepted in the store. Players then spend coins on digital items: skins, emotes and battle passes.

| Layer    | Stack                                                                |
| -------- | -------------------------------------------------------------------- |
| API      | Node.js 24 · Express 5 · TypeScript · Zod 4 · JWT (httpOnly cookie)  |
| Database | PostgreSQL · Prisma 7 (`@prisma/adapter-pg`)                         |
| Web      | Next.js 16 (App Router) · React 19 · TanStack Query · Tailwind CSS 4 |
| Tests    | Vitest + Supertest against a real Postgres (isolated schema)         |
| Tooling  | npm workspaces · ESLint · Prettier · Docker Compose                  |

**Contents:**

- [Features](#features)
- [Getting started](#getting-started)
- [Architecture](#architecture)
- [Keeping the money correct](#keeping-the-money-correct)
- [Security](#security)
- [API reference](#api-reference)
- [Tests](#tests)
- [Design decisions and tradeoffs](#design-decisions-and-tradeoffs)
- [Possible next steps](#possible-next-steps)

---

## Features

### For players

- **Account:** sign up, sign in and sign out. The session lives in an httpOnly cookie, and every new account gets an empty Gold Coin wallet.
- **Item shop:**
  - browse skins, emotes and battle passes in four rarity tiers (Common, Rare, Epic, Legendary);
  - filter by category, search by name, and sort by featured, price, name or newest, with pagination;
  - items you already own show an **Owned** badge, and every item has its own detail page.
- **Buy Gold Coins:**
  - five coin packs, with bonus coins on bigger packs and the best-value pack highlighted;
  - a mock card checkout with test cards for success, declines, insufficient funds and expired cards;
  - card details are tokenized in the browser and never sent to the server.
- **Spend coins:**
  - a confirmation dialog shows the price, your balance and your balance afterwards;
  - if you're short, it tells you how many coins you need and links to the coin store;
  - you can't buy an item twice or pay a price that changed since you looked.
- **Wallet:**
  - your balance is always visible in the header;
  - the full transaction history shows every credit and debit with the running balance;
  - your coin purchase history includes declined payments.
- **Inventory:** every item you own, grouped by category, with when you unlocked it. Owned items stay viewable even after they're removed from the store.

### For admins

The admin console is at `/admin`.

- **Overview:** revenue, coins sold, coins spent, coins in circulation, players, purchases and refunds.
- **Catalog:** create and edit products, and hide or restore them (a soft delete, so existing purchases stay intact).
- **Players:** search players, see their balances and item counts, and credit or debit coins. Every adjustment requires a reason and is recorded in the ledger with the admin's id.
- **Purchases:** list and filter purchases, and refund one. A refund returns the coins and revokes the item, and can only happen once.

### Platform

- **Money safety:**
  - an append-only ledger records every coin movement;
  - balances can never go negative, which the database itself enforces;
  - money-moving requests are idempotent;
  - the payment flow is crash-safe and concurrency-safe.
  - See [Keeping the money correct](#keeping-the-money-correct).
- **Security:** rate limiting on login, sign-up and every money-moving endpoint, plus card-testing protection, validated input everywhere and hardened sessions. See [Security](#security).
- **Developer experience:**
  - one-command Docker stack;
  - idempotent seed data with demo accounts;
  - Prisma Studio for browsing data;
  - 62 automated tests;
  - lint, format and typecheck in one command (`npm run check`).

---

## Getting started

> Everything below is enough to run the project. **[SETUP.md](SETUP.md)** goes deeper: every environment variable, hosted databases, Docker commands and troubleshooting.

### Option A: Docker (one command)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/), running.

```bash
docker compose up --build
```

This starts PostgreSQL, applies migrations, seeds the demo data, then starts the API and the web app. Open **http://localhost:3000**.

- **Stop:** `docker compose down`
- **Stop and delete the data:** `docker compose down -v`
- **Follow the logs:** `npm run docker:logs`

### Option B: Local development (hot reload)

**1. Prerequisites.**

- Node.js **22.12+** (24 recommended, see `.nvmrc`).
- A **PostgreSQL 14+** database (step 3).

**2. Install dependencies.** This installs both apps and generates the Prisma client.

```bash
npm install
```

**3. Start a database.** Pick one:

- **Docker:** run `npm run db:up`. This starts only Postgres, on `localhost:5432`.
- **Supabase, Neon or another hosted Postgres:** use its connection URLs in step 4.
- **A local PostgreSQL install.**

**4. Configure the API.** All settings live in **`apps/api/.env`**. The file goes in `apps/api/`, not in the repo root.

```bash
cp apps/api/.env.example apps/api/.env
```

- **Docker Postgres:** the default `DATABASE_URL` in the example already works.
- **Supabase:** set `DATABASE_URL` to the transaction pooler (port 6543, `?pgbouncer=true`) and `DIRECT_URL` to the session pooler (port 5432). Migrations can't run through the transaction pooler. Add `schema=coinvault` to both URLs. `.env.example` has a full example.
- **Web app:** it needs no configuration.

**5. Create the schema and demo data.** This is safe to re-run.

```bash
npm run db:setup
```

**6. Start the app.**

```bash
npm run dev
```

This starts the API on **http://localhost:4000** (restarts on save) and the web app on **http://localhost:3000** (hot reload).

**7. Check it works.** Open http://localhost:3000, or:

```bash
curl http://localhost:4000/api/health      # {"status":"ok",...}
```

### Demo accounts

| Account               | Password     | State                                              |
| --------------------- | ------------ | -------------------------------------------------- |
| `demo@coinvault.dev`  | `Demo123!`   | 525 coins, owns 2 items, one declined card payment |
| `alex@coinvault.dev`  | `Player123!` | 350 coins: a refund and an admin adjustment        |
| `sam@coinvault.dev`   | `Player123!` | 0 coins, one failed payment                        |
| `admin@coinvault.dev` | `Admin123!`  | Admin console: catalog, balances, refunds          |

### Test cards

Any future expiry date and any CVC work. The checkout tokenizes the card in the browser, so the API only ever sees a token.

| Card                  | Result               |
| --------------------- | -------------------- |
| `4242 4242 4242 4242` | Success (Visa)       |
| `5555 5555 5555 4444` | Success (Mastercard) |
| `4000 0000 0000 0002` | Declined             |
| `4000 0000 0000 9995` | Insufficient funds   |
| `4000 0000 0000 0069` | Expired card         |

### Seeing the data

```bash
npm run db:studio    # Prisma Studio: browse users, wallets, the ledger, orders, purchases
```

The seed creates 5 coin packs, 14 products (one of them hidden) and the 4 demo accounts. All seeded coin movements go through the same services the API uses, so the seeded ledger reconciles exactly. Re-running `npm run db:seed` is safe.

### Scripts

Run these from the repo root.

| Script                              | What it does                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                       | API (tsx watch) + web (next dev) together                      |
| `npm run dev:api` / `dev:web`       | Run one app only                                               |
| `npm run db:setup`                  | Apply migrations, then seed (first-time setup)                 |
| `npm run db:migrate`                | Apply pending migrations (`prisma migrate deploy`)             |
| `npm run db:seed`                   | Seed the catalog and demo accounts (idempotent)                |
| `npm run db:studio`                 | Open Prisma Studio                                             |
| `npm test`                          | API integration tests (needs a database) + web unit tests      |
| `npm run check`                     | Everything CI should run: format check, lint, typecheck, tests |
| `npm run lint` / `format`           | ESLint (both apps) / Prettier (whole repo)                     |
| `npm run typecheck`                 | Type-check both apps                                           |
| `npm run build` / `npm start`       | Production build / run both apps without Docker                |
| `npm run docker:up` / `docker:down` | Start (in the background) / stop the full Docker stack         |
| `npm run docker:logs`               | Follow API and web logs from Docker                            |
| `npm run db:up` / `db:down`         | Start / stop only the Docker Postgres, for local development   |

To change the schema, edit `apps/api/prisma/schema.prisma`, then run `cd apps/api && npx prisma migrate dev --name <change>`.

---

## Architecture

```
Browser ──▶ Next.js (:3000) ──rewrite /api/*──▶ Express API (:4000) ──▶ PostgreSQL
            client components,                  routes → services → Prisma
            TanStack Query
```

- The browser only talks to the Next.js origin, and Next proxies `/api/*` to Express. The session cookie is therefore first-party (`httpOnly`, `SameSite=Lax`), and no CORS setup is needed.
- All data fetching happens on the client with TanStack Query. Mutations invalidate the wallet, catalog and inventory queries, so the header balance updates immediately.
- The API is layered with one rule per layer:
  - **Routes** are HTTP only: they validate input with Zod, call a service, and shape the response. They never touch Prisma.
  - **Services** own the business rules, the queries and the transactions.
  - **`lib/`** holds framework-free helpers: errors, pagination and DTOs.

```
apps/
  api/
    prisma/schema.prisma            data model
    prisma/migrations/              SQL migrations (+ CHECK constraints & ledger trigger)
    prisma/seed.ts                  idempotent demo data (catalog only in production)
    src/
      app.ts, server.ts             app factory (used by tests) / process entry + graceful shutdown
      config/env.ts                 validated environment
      db/                           Prisma client, transaction helper (retries deadlocks)
      middleware/                   auth (cookie/bearer), rate limiting, error handler
      routes/                       HTTP layer, one router per resource
      services/
        walletService.ts            credit/debit: the ONLY code that changes a balance; ledger history
        coinPurchaseService.ts      buy coins (mock payment, idempotent, crash-safe)
        purchaseService.ts          buy products, refunds, purchase history, inventory
        catalogService.ts           catalog listing/search with ownership flags
        adminService.ts             stats, catalog management, players, audited balance adjustments
        authService.ts              register/login, JWT
        payment/mockProvider.ts     provider interface + mock implementation
      lib/                          errors, request helpers, pagination, DTO serializers
    test/                           integration tests against real Postgres
    Dockerfile
  web/
    src/app/                        routes: thin server components (metadata) rendering a view
    src/views/                      page-level client components (admin/ split per tab)
    src/components/                 UI primitives, dialogs (checkout, buy), header
    src/lib/                        API client, query hooks, card tokenizer, navigation helpers (+ unit tests)
    Dockerfile
docker-compose.yml                  postgres + migrate (one-shot) + api + web
```

**Pages:**

| Page                  |                                |
| --------------------- | ------------------------------ |
| `/`                   | Store                          |
| `/products/[id]`      | Product detail                 |
| `/coins`              | Buy Gold Coins                 |
| `/wallet`             | Wallet and transaction history |
| `/inventory`          | Inventory                      |
| `/admin`              | Admin console                  |
| `/login`, `/register` | Sign in, sign up               |

**Tooling:** one Prettier config for the whole repo, ESLint in both apps (the API uses type-aware rules such as `no-floating-promises`), and TypeScript strict mode everywhere. `npm run check` runs all of it.

---

## Keeping the money correct

The core requirement is that coins can never be created, lost or spent twice. These rules are enforced by the **database**, not just by application code.

| Invariant                                    | How it's enforced                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money is integer                             | Coins and cents are `INT` columns. No floats anywhere.                                                                                                                                                                                                                                                                    |
| A balance can never go negative              | The debit is one conditional statement, `UPDATE wallets SET balance = balance - $n WHERE user_id = $u AND balance >= $n`, which takes a row lock and re-checks the condition. As a backstop, a `CHECK (balance >= 0)` constraint is on the table.                                                                         |
| Every coin movement is auditable             | `walletService.credit/debit` is the only balance mutator. It always writes a `ledger_entries` row (with `balance_after`) in the same transaction.                                                                                                                                                                         |
| The ledger is append-only                    | A Postgres trigger rejects `UPDATE`/`DELETE` on `ledger_entries`. Corrections are new, compensating entries.                                                                                                                                                                                                              |
| Each entry points to its cause               | A `CHECK` constraint requires a coin-purchase credit to reference a payment order, a purchase debit or refund to reference a purchase, and an adjustment to reference an admin.                                                                                                                                           |
| A payment is credited at most once           | `UNIQUE (payment_order_id)` on the ledger, plus a conditional `PENDING → SUCCEEDED` transition.                                                                                                                                                                                                                           |
| A purchase is debited once and refunded once | `UNIQUE (purchase_id, reason)` on the ledger, plus a conditional `COMPLETED → REFUNDED` transition.                                                                                                                                                                                                                       |
| An item is owned at most once                | `UNIQUE (user_id, product_id)` on `inventory_items`.                                                                                                                                                                                                                                                                      |
| Client retries never double-charge           | Money-moving POSTs require an `Idempotency-Key` header, enforced by `UNIQUE (user_id, idempotency_key)` on orders and purchases, and `UNIQUE (actor_id, idempotency_key)` on admin adjustments. A retry returns the original result with `Idempotent-Replayed: true`. Reusing a key with a different payload returns 422. |
| Reconciliation                               | `wallet.balance == Σ credits − Σ debits` for every wallet. The tests assert this after every scenario.                                                                                                                                                                                                                    |

### Buying coins: `POST /api/coin-purchases`

1. Find or create a `PENDING` payment order for the idempotency key. The order snapshots the coins and price.
2. Charge the (mock) provider **outside** any DB transaction. The provider call is idempotent, keyed by order id, as Stripe's is.
3. On success, one transaction: a conditional `PENDING → SUCCEEDED` update, then a wallet credit and a ledger entry. A decline marks the order `FAILED` and returns `402 PAYMENT_DECLINED`.
4. If the process crashes between steps 2 and 3, the order stays `PENDING`. A retry with the same key re-runs steps 2 and 3, and step 3 runs exactly once.

### Buying a product: `POST /api/purchases`

One transaction runs all four writes: a purchase row (price snapshot), the guarded wallet debit, the ledger entry, and the inventory item.

- **Price check:** the client sends `expectedPriceCoins`. If the price changed after the user saw it, the API returns `409 PRICE_CHANGED`.
- **Concurrent spending:** races are settled by row locks and unique constraints. The tests fire 5 parallel 30-coin purchases at a 100-coin wallet, and exactly 3 succeed, leaving a balance of 10.
- **Isolation level:** READ COMMITTED is enough, because correctness comes from conditional writes and constraints, not from reads. Transient deadlocks (P2034) are retried.

---

## Security

### Authentication and sessions

- **Passwords:** hashed with bcrypt. Passwords longer than bcrypt's 72-byte limit are rejected rather than silently truncated.
- **Login:** responds in the same time and with the same error whether the email exists or not.
- **Session tokens:** an HS256 JWT in an **httpOnly**, `SameSite=Lax` cookie, `Secure` in production (`COOKIE_SECURE`). API clients can send `Authorization: Bearer` instead.
- **Fresh user data:** the user is re-read from the database on every request, so role changes and deleted accounts take effect immediately.
- **Production guards:** the API refuses to start with the dev or placeholder `JWT_SECRET`, and the seed won't create demo accounts unless `SEED_DEMO_USERS=true`.

### Rate limiting

Every limit is defined in `apps/api/src/middleware/rateLimit.ts` (`RATE_LIMITS`).

| Limit                          | Key             | Applies to                                | Why                                                                                                           |
| ------------------------------ | --------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 5 **failed** logins / 15 min   | account (email) | `POST /auth/login`                        | Stops password guessing against one account, even if the attacker rotates IPs. Successful logins don't count. |
| 30 attempts / 15 min           | client IP       | `POST /auth/login`, `POST /auth/register` | Slows credential stuffing across many accounts and sign-up spam                                               |
| 10 coin purchases / 10 min     | user            | `POST /coin-purchases`                    | Caps real-money payment attempts                                                                              |
| 5 **declined** payments / hour | user            | `POST /coin-purchases`                    | Stops card testing: once triggered, card payments pause, even with a valid card                               |
| 30 purchases / min             | user            | `POST /purchases`                         | Stops scripted purchase flooding                                                                              |
| 60 writes / min                | admin           | `POST`/`PATCH`/`DELETE` under `/admin`    | Limits damage from a runaway script or a hijacked admin session                                               |

- **Reads are never limited.** Anonymous requests to user-keyed routes aren't counted; they get a 401.
- **Per-user keys are reliable:** they can't be spoofed, and users sharing an IP behind a proxy don't share a limit.
- **Blocked requests** get `429 RATE_LIMITED` with `Retry-After`, the draft-8 `RateLimit` headers, and `details.retryAfterSeconds`.
- **Client IP and spoofing:** the Next.js rewrite proxy doesn't add `X-Forwarded-For`, and a client can send that header itself. The API therefore ignores it by default (`TRUST_PROXY=false`), so IPs can't be spoofed to dodge the per-IP limit. The per-account limit doesn't depend on IPs at all.
- **Production:** put a load balancer or CDN in front that appends `X-Forwarded-For`, and set `TRUST_PROXY=1` so per-IP limits see real client IPs. Keep the API itself private, reachable only from the web tier.
- **Multiple instances:** limits are held in memory per API instance. If you run several, use a shared store such as `rate-limit-redis`.

### Input and output handling

- **Validated input:** every request body, query string and path parameter is validated with Zod. IDs must be UUIDs, and product image URLs must be `https://`.
- **Responses:** DTOs strip internal fields (password hashes, idempotency keys, request hashes, other users' ids). Errors have a consistent shape and never leak stack traces.
- **Card data:** the browser tokenizes cards, so card numbers never reach the server.
- **Logs:** cookies and authorization headers are redacted.
- **Redirects:** the post-login `?next=` redirect only allows same-site paths.
- **Headers and limits:** `helmet` sets security headers, and request bodies are capped at 100 kB.
- **Docker:** both images run as a non-root user, and local `.env` files are never copied into an image.

---

## API reference

All endpoints are under `/api`. Errors use the shape `{ "error": { "code", "message", "details?" } }`. Auth is the `cv_session` httpOnly cookie, or `Authorization: Bearer <token>` for API clients. See [Rate limiting](#rate-limiting) for which endpoints are limited.

| Method         | Path                                          | Auth     | Description                                                                    |
| -------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| GET            | `/health`                                     | —        | Liveness + DB check                                                            |
| POST           | `/auth/register`                              | —        | `{email, password, name}` → creates user + empty wallet, sets cookie           |
| POST           | `/auth/login`                                 | —        | `{email, password}` → sets cookie                                              |
| POST           | `/auth/logout`                                | —        | Clears cookie                                                                  |
| GET            | `/auth/me`                                    | user     | Current user                                                                   |
| GET            | `/wallet`                                     | user     | `{balance, updatedAt}`                                                         |
| GET            | `/wallet/transactions?page&limit&type&reason` | user     | Ledger, newest first, with descriptions                                        |
| GET            | `/coin-packages`                              | —        | Active coin packages                                                           |
| POST           | `/coin-purchases`                             | user     | `{packageId, paymentToken}` + `Idempotency-Key` → `{order, balance}`           |
| GET            | `/coin-purchases?page&limit`                  | user     | Your payment orders (incl. failed)                                             |
| GET            | `/products?category&search&sort&page&limit`   | optional | Catalog; includes `owned` when signed in                                       |
| GET            | `/products/:id`                               | optional | Product detail (also for delisted products you own)                            |
| POST           | `/purchases`                                  | user     | `{productId, expectedPriceCoins?}` + `Idempotency-Key` → `{purchase, balance}` |
| GET            | `/purchases?page&limit`                       | user     | Your purchase history                                                          |
| GET            | `/inventory`                                  | user     | Items you own                                                                  |
| GET            | `/admin/stats`                                | admin    | Revenue, coins sold/spent/in circulation, refunds                              |
| GET / POST     | `/admin/products`                             | admin    | List (incl. hidden) / create                                                   |
| PATCH / DELETE | `/admin/products/:id`                         | admin    | Partial update / soft-delete (hide from store)                                 |
| GET            | `/admin/users?search&page`                    | admin    | Players with balances                                                          |
| POST           | `/admin/users/:id/adjust`                     | admin    | `{amount (±), note}` + `Idempotency-Key`: audited credit/debit, never below 0  |
| GET            | `/admin/purchases?status&page`                | admin    | All purchases                                                                  |
| POST           | `/admin/purchases/:id/refund`                 | admin    | Refund coins + revoke item (once)                                              |

**Error codes:**

| Status | Codes                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_AMOUNT`, `IDEMPOTENCY_KEY_REQUIRED`, `BAD_REQUEST` |
| 401    | `UNAUTHORIZED`, `INVALID_CREDENTIALS`                                                           |
| 402    | `INSUFFICIENT_FUNDS`, `PAYMENT_DECLINED`                                                        |
| 403    | `FORBIDDEN`                                                                                     |
| 404    | `NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `PACKAGE_UNAVAILABLE`, `ROUTE_NOT_FOUND`                    |
| 409    | `EMAIL_TAKEN`, `ALREADY_OWNED`, `PRICE_CHANGED`, `ALREADY_REFUNDED`, `SKU_TAKEN`, `CONFLICT`    |
| 413    | `PAYLOAD_TOO_LARGE`                                                                             |
| 422    | `IDEMPOTENCY_KEY_REUSED`                                                                        |
| 429    | `RATE_LIMITED`                                                                                  |
| 500    | `INTERNAL_ERROR`                                                                                |
| 503    | `TRY_AGAIN`                                                                                     |

Example:

```bash
curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@coinvault.dev","password":"Demo123!"}'          # → { user, token }

curl -s -X POST localhost:4000/api/purchases \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" -d '{"productId":"<id>"}'         # repeat it: same result, charged once
```

---

## Tests

```bash
npm test     # 54 API integration tests against real Postgres + 8 web unit tests
```

Tests run in a dedicated `coinvault_test` schema inside `DATABASE_URL`'s database, or in `DATABASE_URL_TEST` if that is set. They refuse to run against `public`, and refuse to run if `DATABASE_URL` and `DIRECT_URL` point at different databases. They cover:

- **Auth:** registration creates a wallet; duplicate emails (case-insensitive); validation; cookie vs bearer; 401/403.
- **Coins:** success with bonus; decline credits nothing; idempotent replay; key reuse returns 422; tokens only (no card numbers); crash recovery of a `PENDING` order; 5 concurrent identical requests credit once.
- **Purchases:** debit + inventory + ledger; insufficient funds changes nothing; already owned; inactive product; price changed; replay; `owned` flags in the catalog.
- **Concurrency:** no overdraft under parallel spending; an item is sold once under parallel buys; one charge for 10 parallel same-key requests; a mixed multi-user load test.
- **Admin & DB guards:** catalog CRUD (PATCH only changes the fields sent; https-only image URLs); refund exactly once; adjustments are audited, idempotent and never go negative; the ledger trigger blocks edits; the `CHECK` constraint blocks negative balances.
- **Rate limiting:**
  - an account locks after 5 failed logins, even with the right password, and successful logins don't count;
  - per-client limits apply across many accounts, and spoofed `X-Forwarded-For` is ignored;
  - per-user limits on coin purchases, declined payments (card testing), product purchases and admin writes;
  - reads and anonymous requests are not limited.
- **API hygiene:** history endpoints are scoped to the caller; ledger DTOs don't leak internal ids; catalog filter, search and pagination; structured errors for bad JSON, oversized bodies and bad ids.
- **Web unit tests:** card validation (Luhn, expiry, CVC), tokenization, and open-redirect protection on `?next=`.

---

## Design decisions and tradeoffs

- **PostgreSQL + Prisma.** A currency system is a ledger, and relational constraints (CHECK, UNIQUE, FK, triggers) let the database guarantee the invariants. Prisma 7 gives typed queries and migrations; the few things Prisma can't model (CHECK constraints, the trigger) are plain SQL in the migration.
- **Separate wallet + ledger, not a computed balance.** Reading a balance is O(1), and the ledger is the audit trail. They can't drift apart, because both change in the same transaction through one function, and the tests reconcile them.
- **Mock payments shaped like a real provider.**
  - Card data is tokenized client-side, so the server stays out of PCI scope.
  - Charges are idempotent by order id.
  - The external call happens outside the DB transaction.
  - Swapping in Stripe would mean implementing `PaymentProvider` and confirming via webhook.
- **Idempotency keys on every money-moving POST.** The UI generates one key per attempt, so double clicks and network retries are harmless. A declined card gets a fresh key for the next attempt.
- **Each item is owned once.** This fits skins, emotes and season passes. Consumables would need quantity-based inventory instead of the unique constraint.
- **Admin refunds and adjustments are compensating ledger entries,** never edits.
- **Client-side data fetching.** The UI is an authenticated, highly interactive app. Fetching on the client through a same-origin proxy keeps auth simple: one httpOnly cookie, no token forwarding in Server Components, no CORS.
- **One API image for serving, migrating and seeding.** It keeps the Prisma CLI and tsx, which makes the image larger (~900 MB) but means a single build to deploy.

## Possible next steps

- Real payment provider (Stripe PaymentIntents + webhook-driven finalization), plus a reconciliation job for stale `PENDING` orders.
- Cart / multi-item checkout, limited-stock items, and time-limited offers.
- Refresh tokens and session revocation; email verification.
- A shared package for API types and Zod schemas, so the web app's types can't drift from the API's.
- CI running `npm run check`, an OpenAPI spec generated from the Zod schemas, and metrics on payment outcomes and conflicts.
- A slimmer API runtime image (separate migration image, production-only dependencies).
