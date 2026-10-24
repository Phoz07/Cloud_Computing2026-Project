# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t eventide/web .
#
# Static SPA served by nginx from inside the cluster, behind the same
# ingress-nginx as the API — one origin, no CORS, no mixed content, and no
# CloudFront (denied in the lab — docs/lab-probe-2026-09-07.txt).

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY apps/auth/package.json apps/auth/
COPY apps/event/package.json apps/event/
COPY apps/mail-worker/package.json apps/mail-worker/
COPY apps/payment/package.json apps/payment/
COPY apps/registration/package.json apps/registration/
COPY apps/web/package.json apps/web/
COPY packages/auth-guard/package.json packages/auth-guard/
COPY packages/db/package.json packages/db/
COPY packages/mail/package.json packages/mail/
COPY packages/storage/package.json packages/storage/
COPY packages/tickets/package.json packages/tickets/
RUN bun install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
# vite build only — `bun check` is CI's job; the service packages are devDependencies
# for their exported types (Eden Treaty), erased at build time.
RUN cd apps/web && bunx --bun vite build

# nginx-unprivileged: runs as uid 101, listens on 8080 — fits a locked-down pod.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
