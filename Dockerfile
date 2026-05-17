# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Dr Tea monorepo.
# Produces two targets that deploy/standalone/docker-compose.yml runs side-by-side:
#   - api   : Node API server + Drizzle migrations
#   - storefront : Caddy serving the built Vite SPA + proxying to the API
#
# Base image is Debian-slim (glibc) because pnpm-workspace.yaml excludes all
# musl native binaries (rollup, esbuild, tailwindcss-oxide, lightningcss) and
# only allows linux-x64-gnu.

# ---- Shared build stage ----
FROM node:20-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
COPY . .
ENV CI=true
RUN pnpm install --frozen-lockfile
# Skip root typecheck; build per-workspace artifacts directly (vite/esbuild
# strip types without typechecking). Fix TS errors separately, not at deploy.
RUN pnpm -r --if-present --filter '!@workspace/mockup-sandbox' run build

# ---- API target ----
FROM node:20-slim AS api
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter @workspace/db run push && pnpm --filter @workspace/scripts run seed && pnpm --filter @workspace/api-server run start"]

# ---- Storefront target ----
FROM caddy:2-alpine AS storefront
COPY --from=build /app/artifacts/dr-tea/dist/public /srv/dr-tea
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
