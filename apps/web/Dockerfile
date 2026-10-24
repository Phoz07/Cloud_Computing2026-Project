# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t eventide/web .
#
# The SPA is built with vite, then served by apps/web/server/index.ts (Bun): it
# serves dist/ and injects per-URL <head> tags (title, Open Graph, Twitter) so
# link previews see the event. It reads BETTER_AUTH_URL (public origin) and
# EVENT_SERVICE_URL (in-cluster event Service). /api/* and /files/* never reach it —
# the ingress routes those. Same origin, no CORS, no CloudFront (denied in the lab).
# The server is bundled to /app/server/index.js so `../dist` (import.meta.dir)
# resolves to /app/dist; no node_modules at runtime.

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
RUN cd apps/web && bun build server/index.ts --target bun --minify-whitespace --minify-syntax --outfile /out/server/index.js

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /out/server/index.js ./server/index.js
COPY --from=build /app/apps/web/dist ./dist
ENV NODE_ENV=production
USER 1000
EXPOSE 3000
CMD ["bun", "server/index.js"]
