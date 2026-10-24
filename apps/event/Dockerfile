# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f apps/event/Dockerfile --platform linux/amd64 -t eventide/event .
#
# A bundled `bun build --target bun` file on oven/bun:1-slim, NOT a `--compile`
# binary: the OG image renderer (takumi-js) is a native addon and loads its font
# from node_modules at runtime (import.meta.resolve) — neither exists inside a
# compiled binary. Those two packages stay external and are installed next to the
# bundle; everything else (elysia, drizzle, the @app/* packages) is bundled in.

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
COPY apps/event ./apps/event
RUN bun build apps/event/src/index.ts --target bun --minify-whitespace --minify-syntax \
      --external takumi-js --external @fontsource-variable/google-sans --outfile /out/index.js

FROM oven/bun:1-slim
WORKDIR /app
# versions pinned to what bun.lock resolves
RUN echo '{"dependencies":{"takumi-js":"2.17.1","@fontsource-variable/google-sans":"5.3.2"}}' > package.json \
 && bun install --production && rm -rf /root/.bun/install/cache
COPY --from=build /out/index.js ./index.js
ENV NODE_ENV=production
# uid 1000 = the `bun` user in oven/bun images. Numeric so k8s runAsNonRoot can verify it.
USER 1000
EXPOSE 3000
CMD ["bun", "index.js"]
