# syntax=docker/dockerfile:1
# Build context is the REPO ROOT:
#   docker build -f packages/db/Dockerfile --platform linux/amd64 -t eventide/db-bootstrap .
#
# The migrate image: `drizzle-kit migrate` against DATABASE_URL (the single
# `eventide` database on RDS, or the compose Postgres on k3d). Runs as the
# chart's pre-install/pre-upgrade hook Job (infra/helm/eventide/templates/
# db-migrate-job.yaml), so every `make deploy` migrates before pods roll.
# Not a compiled binary: drizzle-kit is a CLI that reads the config + SQL files.
# ECR repo name stays `db-bootstrap` (it exists; renaming = destroy/recreate).

FROM oven/bun:1-slim
WORKDIR /app
# A focused install (not the monorepo lockfile) keeps the image small. Versions
# pinned to what bun.lock resolves.
RUN bun add postgres@3.4.9 drizzle-orm@0.45.4 drizzle-kit@0.31.11 && rm -rf /root/.bun/install/cache
COPY packages/db/drizzle.config.ts ./
COPY packages/db/src ./src
COPY packages/db/drizzle ./drizzle
ENV NODE_ENV=production
# uid 1000 = the `bun` user in oven/bun images. Numeric so k8s runAsNonRoot can verify it.
USER 1000
CMD ["bunx", "drizzle-kit", "migrate"]
