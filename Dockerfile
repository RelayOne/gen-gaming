# Multi-stage build: install + build, then static serve via Caddy.
# The demo is a static SPA produced by Vite. Cloud Run runs Caddy on :8080.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first to maximise layer cache.
COPY package.json package-lock.json* ./
COPY tsconfig.json vite.config.ts ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --no-audit --no-fund \
  && npm run typecheck \
  && npm --workspace apps/demo run build

# ---------- Stage 2: serve ----------
FROM caddy:2.7-alpine
WORKDIR /srv

COPY --from=build /app/apps/demo/dist /srv
COPY apps/demo/Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
