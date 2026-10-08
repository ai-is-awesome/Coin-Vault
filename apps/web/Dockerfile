# syntax=docker/dockerfile:1
# Coin Vault web app (Next.js standalone server). Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:4000 -t coin-vault-web .
# API_URL is where the Next server proxies /api/*. It is baked in at build time.

FROM node:24-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root --ignore-scripts --no-audit --no-fund

# ---- Build ----
FROM deps AS build
ARG API_URL=http://api:4000
ENV API_URL=$API_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# ---- Runtime: only the traced server files and static assets ----
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
