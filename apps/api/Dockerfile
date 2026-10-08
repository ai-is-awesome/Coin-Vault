# syntax=docker/dockerfile:1
# Coin Vault API. Build from the repository root (npm workspaces share one lockfile):
#   docker build -f apps/api/Dockerfile -t coin-vault-api .
# The same image serves the API (default command) and runs migrations + seed (`npm run db:setup`).

FROM node:24-alpine AS base
# OpenSSL lets Prisma detect the platform for its migration engine.
RUN apk add --no-cache openssl
WORKDIR /app

# ---- Dependencies: cached until a manifest or the Prisma schema changes ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# `postinstall` runs `prisma generate`, which needs the schema and config.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci --workspace apps/api --include-workspace-root --no-audit --no-fund

# ---- Build: TypeScript -> dist ----
FROM deps AS build
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build --workspace apps/api

# ---- Runtime ----
# Keeps the full dependency tree: the Prisma CLI and tsx are needed for migrations and the seed.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health > /dev/null || exit 1
CMD ["node", "dist/server.js"]
