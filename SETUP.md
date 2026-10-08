# Coin Vault - Setup Guide

There are two ways to run Coin Vault:

|            | [Option 1: Docker (everything)](#option-1-run-everything-with-docker) | [Option 2: Local development](#option-2-local-development) |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Best for   | Trying the app, reviewing, demos                                      | Working on the code                                        |
| You need   | Docker Desktop                                                        | Node.js 22.12+ and a PostgreSQL database                   |
| Hot reload | No (production builds)                                                | Yes                                                        |
| Command    | `docker compose up --build`                                           | `npm run dev`                                              |

Both give you the store at **http://localhost:3000** with these demo accounts:

| Account               | Password     | What's in it                                |
| --------------------- | ------------ | ------------------------------------------- |
| `demo@coinvault.dev`  | `Demo123!`   | 525 coins, 2 items, one declined payment    |
| `alex@coinvault.dev`  | `Player123!` | 350 coins, a refund and an admin adjustment |
| `sam@coinvault.dev`   | `Player123!` | 0 coins, one failed payment                 |
| `admin@coinvault.dev` | `Admin123!`  | Admin console: catalog, balances, refunds   |

Payments are simulated. Use the test card **4242 4242 4242 4242** with any future expiry and any CVC. The checkout lists more cards that decline in different ways.

---

## Option 1: Run everything with Docker

### 1. Install and start Docker

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and make sure it is **running**. On Windows and macOS, check for the whale icon in the tray or menu bar. To verify:

```bash
docker info
```

### 2. Start the stack

From the repository root:

```bash
docker compose up --build        # or: npm run docker:up   (runs in the background)
```

The first build takes a few minutes. Later starts take seconds. Compose starts four services in order:

| Service    | What it does                                                                           | Port   |
| ---------- | -------------------------------------------------------------------------------------- | ------ |
| `postgres` | PostgreSQL 17, data kept in the `postgres-data` volume                                 | `5432` |
| `migrate`  | One-shot job: applies migrations, then seeds the catalog and demo accounts, then exits | -      |
| `api`      | Express API (starts once `migrate` has succeeded)                                      | `4000` |
| `web`      | Next.js app (starts once the API is healthy)                                           | `3000` |

Open **http://localhost:3000**. The API is also reachable directly at `http://localhost:4000/api`, for example `curl http://localhost:4000/api/health`.

### 3. Everyday commands

| Task                         | Command                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Follow API and web logs      | `docker compose logs -f api web` (or `npm run docker:logs`)                                                                                              |
| See container status         | `docker compose ps -a`                                                                                                                                   |
| Stop everything (keep data)  | `docker compose down` (or `npm run docker:down`)                                                                                                         |
| Stop and **delete all data** | `docker compose down -v`                                                                                                                                 |
| Rebuild after code changes   | `docker compose up --build -d`                                                                                                                           |
| Re-run migrations and seed   | `docker compose run --rm migrate`                                                                                                                        |
| Open a SQL shell             | `docker compose exec postgres psql -U coinvault`                                                                                                         |
| Browse data in Prisma Studio | Run `npm install` once, then set `DATABASE_URL=postgresql://coinvault:coinvault@localhost:5432/coinvault` in `apps/api/.env` and run `npm run db:studio` |

### 4. Configuration (optional)

The stack works with no configuration. To change something, create a `.env` file **in the repository root**, next to `docker-compose.yml`. Compose reads it automatically.

```env
# Any of these are optional
JWT_SECRET=<32+ random characters>   # required if anyone else can reach your instance
WEB_PORT=3000
API_PORT=4000
POSTGRES_PORT=5432                   # change this if you already run Postgres locally
MOCK_PAYMENT_LATENCY_MS=600
SEED_DEMO_USERS=true                 # false = catalog only, no demo accounts
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**About the Docker images**

- **API:** both images run as the non-root `node` user. The API image runs in production mode, with `COOKIE_SECURE=false` because the stack is served over plain `http://localhost`.
- **Web:** the web image is a Next.js standalone build. Its `/api/*` proxy target (`http://api:4000`) is fixed at **build** time, so rebuild the image if you change it.
- **Local config ignored:** your `apps/api/.env` is not copied into the images (see `.dockerignore`), so local secrets never end up in a container.

---

## Option 2: Local development

### 1. Prerequisites

- **Node.js 22.12+.** Node 24 is recommended; `.nvmrc` is included.
- **A PostgreSQL 14+ database.** Pick one:
  - **Docker:** run `npm run db:up`. This starts only the `postgres` service from the compose file.
  - **Supabase, Neon or another hosted Postgres:** see [Hosted databases](#hosted-databases-supabase-neon).
  - **A local PostgreSQL install.**

### 2. Install

```bash
npm install          # installs both apps and generates the Prisma client
```

### 3. Configure

All settings live in **`apps/api/.env`**. Create it from the example, which documents every variable:

```bash
cp apps/api/.env.example apps/api/.env
```

For the Docker database, the defaults already work:

```env
DATABASE_URL=postgresql://coinvault:coinvault@localhost:5432/coinvault
```

The web app needs no env file. It proxies `/api/*` to `http://127.0.0.1:4000`. If your API runs elsewhere, set `API_URL` in `apps/web/.env.local`.

> Run commands through the npm scripts, from the repo root or `apps/api`. They load `apps/api/.env`; a `.env` anywhere else is not read.

### 4. Create the schema and demo data

```bash
npm run db:setup     # prisma migrate deploy + seed (safe to re-run)
```

### 5. Run

```bash
npm run dev          # API on http://localhost:4000 (tsx watch), web on http://localhost:3000 (next dev)
```

### Hosted databases (Supabase, Neon)

Hosted databases usually give you a **pooled** URL and a **direct/session** URL. Use both:

| Variable       | Supabase value                                            | Used by                         |
| -------------- | --------------------------------------------------------- | ------------------------------- |
| `DATABASE_URL` | Transaction pooler, port **6543**, with `?pgbouncer=true` | The running API                 |
| `DIRECT_URL`   | Session pooler, port **5432**                             | Prisma CLI (migrations, Studio) |

Migrations take advisory locks, which transaction-mode poolers don't support. Without `DIRECT_URL`, `npm run db:setup` hangs.

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=coinvault"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?schema=coinvault"
```

- Find both URLs under **Connect → Connection string** in the Supabase dashboard.
- `<password>` is your database password, without brackets. URL-encode special characters: `@` → `%40`, `#` → `%23`, `/` → `%2F`.
- **`schema=coinvault` matters on Supabase.** Supabase exposes the `public` schema through its auto-generated REST API, so anyone with your project's anon key could read the `users` table. Putting the tables in their own schema avoids that. Disabling the Data API in the dashboard also works.

---

## Environment variables

API settings go in `apps/api/.env` for local development, or in the `environment` section of `docker-compose.yml`.

| Variable                  | Default              | Description                                                                                          |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | - (required)         | PostgreSQL connection string. Supports `?schema=<name>`.                                             |
| `DIRECT_URL`              | -                    | Direct/session URL for the Prisma CLI when `DATABASE_URL` is pooled.                                 |
| `DATABASE_URL_TEST`       | -                    | Separate test database. By default tests use a `coinvault_test` schema in the same database.         |
| `PORT`                    | `4000`               | API port.                                                                                            |
| `JWT_SECRET`              | dev-only value       | 32+ characters. **Required in production** (placeholders are rejected).                              |
| `JWT_EXPIRES_IN_SECONDS`  | `604800`             | Session length (7 days).                                                                             |
| `COOKIE_SECURE`           | `true` in production | Secure-only session cookie. Set `false` when serving production builds over plain http.              |
| `RATE_LIMIT_ENABLED`      | `true`               | Turns off all rate limiting when `false` (the tests do this).                                        |
| `TRUST_PROXY`             | `false`              | Which proxies may report the client IP via `X-Forwarded-For`. Use `1` behind a load balancer or CDN. |
| `MOCK_PAYMENT_LATENCY_MS` | `300`                | Simulated payment provider delay.                                                                    |
| `BCRYPT_ROUNDS`           | `10`                 | Password hashing cost.                                                                               |
| `LOG_LEVEL`               | `info`               | `silent`, `error`, `warn`, `info`, `debug`.                                                          |
| `SEED_DEMO_USERS`         | -                    | In production the seed adds demo accounts only when this is `true`.                                  |

Web (`apps/web/.env.local`, or a Docker build argument):

| Variable  | Default                 | Description                                                                         |
| --------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `API_URL` | `http://127.0.0.1:4000` | Where the Next.js server proxies `/api/*`. Fixed at `next dev` / `next build` time. |

---

## Common tasks

| Task                                             | Command                                                 |
| ------------------------------------------------ | ------------------------------------------------------- |
| Run all tests (API integration + web unit)       | `npm test` (needs `DATABASE_URL`)                       |
| Run everything CI should run                     | `npm run check` (format, lint, typecheck, tests)        |
| Format / lint                                    | `npm run format` / `npm run lint`                       |
| Browse the database                              | `npm run db:studio`                                     |
| Apply new migrations                             | `npm run db:migrate`                                    |
| Re-seed (idempotent)                             | `npm run db:seed`                                       |
| Create a migration after editing `schema.prisma` | `cd apps/api && npx prisma migrate dev --name <change>` |
| Production build without Docker                  | `npm run build`, then `npm start`                       |

Tests run against a real Postgres, in an isolated `coinvault_test` schema, so they never touch your app data. They refuse to run against the `public` schema.

---

## Troubleshooting

| Symptom                                                                       | Fix                                                                                                                         |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon` / `dockerDesktopLinuxEngine` pipe error | Start Docker Desktop and wait until `docker info` works.                                                                    |
| `port is already allocated`                                                   | Something else uses 3000, 4000 or 5432. Stop it, or set `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` in the root `.env`.       |
| `Invalid environment configuration: DATABASE_URL`                             | `apps/api/.env` is missing or in the wrong folder. It must be in `apps/api/`.                                               |
| `npm run db:setup` hangs or times out (Supabase/Neon)                         | You are migrating through a transaction pooler. Set `DIRECT_URL` (see [Hosted databases](#hosted-databases-supabase-neon)). |
| `P1001: Can't reach database server`                                          | The database isn't running (`npm run db:up`), or the host, port or password in the URL is wrong.                            |
| Signed out after restarting the API                                           | Expected if `JWT_SECRET` changed. Sign in again.                                                                            |
| Docker: login doesn't stick                                                   | Make sure the API container has `COOKIE_SECURE=false` when using plain http (the compose file sets it).                     |
| Docker: code changes don't show up                                            | Rebuild: `docker compose up --build -d`.                                                                                    |
| Start over with a clean database                                              | Docker: `docker compose down -v`, then `docker compose up --build`. Local: drop the schema and run `npm run db:setup`.      |
