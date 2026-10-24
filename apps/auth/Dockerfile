# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f apps/auth/Dockerfile --platform linux/amd64 -t eventide/auth .
#
# Compiled to a single Bun binary on glibc distroless (SYSTEM-DESIGN §12.1):
# 2-3x lower runtime memory than running the source. glibc build image ->
# glibc distroless runtime (NOT alpine/musl).

FROM oven/bun:1 AS build
WORKDIR /app

# Install keyed on the workspace manifests only — every workspace's package.json,
# so the frozen lockfile resolves as-is. Identical across all images, so this
# layer is built once and shared.
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
COPY apps/auth ./apps/auth

ENV NODE_ENV=production
# --minify-whitespace/--minify-syntax only (full --minify mangles names).
RUN cd apps/auth && bun build --compile --minify-whitespace --minify-syntax --target bun \
      --outfile /app/server src/index.ts
# Second entrypoint: promote a registered user to admin (scripts/admin.sh runs it as a one-off pod).
RUN cd apps/auth && bun build --compile --minify-whitespace --minify-syntax --target bun \
      --outfile /app/promote-admin scripts/promote-admin.ts

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /app/server ./server
COPY --from=build /app/promote-admin ./promote-admin
ENV NODE_ENV=production
USER nonroot
EXPOSE 3000
CMD ["./server"]
