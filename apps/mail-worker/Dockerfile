# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f apps/mail-worker/Dockerfile --platform linux/amd64 -t eventide/mail-worker .
#
# A bundled `bun build --target bun` file on oven/bun:1-slim, NOT a `--compile`
# binary: the React Email templates attach emails/static/logo.png by a path
# relative to import.meta.dir (src/render.tsx), which a compiled binary does not
# have. The bundle sits at /app/src/index.js so ../emails/static/logo.png resolves.
# No HTTP server: an SQS long-poll loop. No EXPOSE, no probes.

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
COPY apps/mail-worker ./apps/mail-worker
RUN bun build apps/mail-worker/src/index.ts --target bun --minify-whitespace --minify-syntax --outfile /out/src/index.js

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /out/src/index.js ./src/index.js
COPY apps/mail-worker/emails/static ./emails/static
ENV NODE_ENV=production
USER 1000
CMD ["bun", "src/index.js"]
