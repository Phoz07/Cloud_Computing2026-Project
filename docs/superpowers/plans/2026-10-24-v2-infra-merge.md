# v2 App on the Existing Infra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main` = the finished v2 Eventide app, deployable on the existing EKS/RDS/ECR/S3 infra with the same `make up → make deploy → make down` session lifecycle, with k3d local parity.

**Architecture:** Branch from the v2 tip (a fast-forward of `main`), restore the infra tree from `main`, then adapt it to v2's shape: one Postgres DB + `drizzle-kit migrate` hook Job, Redis pod, SQS mail queue + `mail-worker` Deployment, `/files/*` Ingress → S3, per-service `/api/<prefix>/health` probes, session-cred k8s Secrets built by `deploy.sh`. App code changes: one env knob + build glue only.

**Tech Stack:** Bun 1.4 workspaces, Elysia 2 RC, Drizzle + postgres.js, Vite/React, Docker (Bun `--compile` → distroless), Helm 3, ingress-nginx 4.15, Terraform 1.16 (AWS provider), k3d, AWS Learner Lab (us-east-1).

**Spec:** `docs/superpowers/specs/2026-10-24-v2-infra-merge-design.md` — read it first; every decision below argues from it.

## Global Constraints

- Nothing here needs AWS credentials. AWS-touching steps are listed under "Deferred to a lab session" at the end and are NOT part of any task.
- Never commit `.env`, `*.auto.tfvars`, or any `ASIA…` credential. Never paste session tokens into docs.
- `20-platform` resources stay as they are (EKS, NLB, ingress-nginx, metrics-server, route53). Only `rds.tf` changes.
- Liveness/readiness probes hit `GET /api/<prefix>/health` (returns `โอเค`, touches nothing). No probe may touch Postgres or Redis.
- No app behaviour changes. Allowed app edits: `packages/db/src/index.ts` (pool knob), `docker-compose.yml` (bind host), Dockerfiles, `.dockerignore`.
- Images: `bun build --compile --minify-whitespace --minify-syntax --target bun`, runtime `gcr.io/distroless/base-debian12:nonroot` (uid 65532). Fallback per image if a dep refuses to compile: run from source on `oven/bun:1-slim`, `USER 1000`.
- Helm values: `values.yaml` (defaults) + `values.local.yaml` (k3d) + `values.aws.yaml` (EKS). Image tags pinned per deploy with `--set`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Prerequisites on the machine before Task 9: `k3d`, `helm`, `kubectl` (Arch: `sudo pacman -S helm kubectl`; k3d: `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash`). Present: docker, terraform 1.16, bun.

## Review Focus

1. `GET /files/<key>` for a key outside `public/` (e.g. `/files/private/x`) must be 403/404, never 200 — pinned in Task 9 GATE step.
2. Health probes must succeed with Postgres and Redis unreachable (a 5 s RDS blip must not restart every pod) — pinned in Task 3 step 6.
3. A 3 MiB cover upload through ingress-nginx must not 413 (default `proxy-body-size` is 1m; kinds allow up to 10 MiB) — pinned in Task 9 GATE step.
4. Session cookie must survive the ingress hop over plain HTTP (no `__Secure-` prefix when `BETTER_AUTH_URL` is `http://`) — pinned in Task 9 GATE step (login then `get-session`).
5. `mail-worker` with an unreachable queue must log and retry, not CrashLoop; with `GMAIL_*` unset it must log "dry-run" — pinned in Task 9 GATE step.

---

### Task 1: Branch from v2, restore the infra tree from `main`

**Files:**
- Create branch `feat/v2-infra` at tag `_suwizx_v2` (= `main` + 17 commits).
- Restore from `main`: `infra/terraform/`, `infra/helm/`, `scripts/check-lab.sh`, `scripts/deploy.sh`, `scripts/teardown.sh`, `scripts/k3d-up.sh`, `scripts/k3d-down.sh`, `Makefile`, `load/`, `.github/workflows/ci.yml`, `.dockerignore`, `apps/web/nginx.conf`, `docs/` (everything; v2's `docs/{auth,storage,stripe,tickets}.md` already exist and stay).
- Do NOT restore: `infra/k8s/`, `scripts/{smoke.ts,seed.sh,screenshots.ts,db-bootstrap.sh}`, `apps/*/Dockerfile`, `packages/db/Dockerfile`, `turbo.json`, `biome.json`, `packages/shared/`.
- Also add the two untracked docs: `docs/superpowers/specs/2026-10-24-v2-infra-merge-design.md`, `docs/superpowers/plans/2026-10-24-v2-infra-merge.md`.

**Interfaces:**
- Produces: a branch where `bun install --frozen-lockfile` passes and `infra/`, `scripts/`, `Makefile`, `load/`, `.github/` exist exactly as on `main` (adapted in later tasks).

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feat/v2-infra _suwizx_v2 && git log --oneline -1`
Expected: `e5f0759 feat : refund impliment`

- [ ] **Step 2: Restore the infra paths from `main`**

```bash
git checkout main -- infra/terraform infra/helm \
  scripts/check-lab.sh scripts/deploy.sh scripts/teardown.sh scripts/k3d-up.sh scripts/k3d-down.sh \
  Makefile load .github .dockerignore apps/web/nginx.conf docs
git status --short | grep -vE '^A ' ; echo "---"; ls infra scripts docs | head -40
```
Expected: only `A` (added) lines; `infra/{helm,terraform}`, 5 scripts, `docs/SYSTEM-DESIGN.md` etc. present; `infra/k8s` absent.

- [ ] **Step 3: Carry the Terraform ignores into v2's `.gitignore`**

v2's `.gitignore` has no Terraform lines; without them `terraform init` output gets committed. Append:
```
# terraform (commit .terraform.lock.hcl — it pins provider versions)
.terraform/
*.tfstate
*.tfstate.*
crash.log
*.tfvars.local
*.auto.tfvars
!*.auto.tfvars.example
```
Run: `git check-ignore -q infra/terraform/10-foundation/.terraform/x && git check-ignore -q infra/terraform/10-foundation/google.auto.tfvars && echo ignored`
Expected: `ignored`.

- [ ] **Step 4: Verify the workspace still installs**

Run: `bun install --frozen-lockfile && echo OK`
Expected: `OK` (no lockfile changes; restored paths hold no package.json).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: restore infra, scripts, docs from main onto the v2 app

v2 re-scaffolded the repo and dropped infra/, scripts/, Makefile, load/, CI
and docs/. Bring them back verbatim; the following commits adapt them to the
v2 shape (single DB, Redis, SQS mail worker, /files via S3).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Runtime knobs — DB pool size, compose bind host, `.dockerignore`

**Files:**
- Modify: `packages/db/src/index.ts:5`
- Create: `packages/db/test/pool.test.ts`
- Modify: `docker-compose.yml` (the 6 `ports:` entries)
- Modify: `.dockerignore`

**Interfaces:**
- Produces: env `DB_POOL_MAX` (integer, default `10`) read once at import by `@app/db`; env `BIND_HOST` (default `127.0.0.1`) for compose port bindings.

- [ ] **Step 1: Write the failing test**

`packages/db/test/pool.test.ts`:
```ts
import { expect, test } from "bun:test";

test("DB_POOL_MAX sets the postgres.js pool size", async () => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/db";
  process.env.DB_POOL_MAX = "3";
  const { db } = await import("../src/index");
  expect(db.$client.options.max).toBe(3);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/db && bun test test/pool.test.ts`
Expected: FAIL — `expected 3, received 10`.

- [ ] **Step 3: Implement the knob**

In `packages/db/src/index.ts` replace the `db` line with:
```ts
// ponytail: pool per process; the chart sets DB_POOL_MAX=4 (db.t3.micro ≈ 87 connections, 13 pods under HPA)
const max = Number(process.env.DB_POOL_MAX ?? 10);
export const db = drizzle(postgres(process.env.DATABASE_URL!, { max }), { schema });
```

- [ ] **Step 4: Run the test**

Run: `cd packages/db && bun test test/pool.test.ts`
Expected: PASS.

- [ ] **Step 5: Parameterise the compose bind host**

In `docker-compose.yml`, every `"127.0.0.1:<port>:<port>"` becomes `"${BIND_HOST:-127.0.0.1}:<port>:<port>"` (postgres 5432, redis 6379, elasticmq 9324 + 9325, minio 9000 + 9001). k3d pods reach the host via `host.k3d.internal`, which a loopback-only binding cannot serve.

Run: `BIND_HOST=0.0.0.0 docker compose config | grep -c 'host_ip: 0.0.0.0'; docker compose config | grep -c 'host_ip: 127.0.0.1'`
Expected: `6` then `6`.

- [ ] **Step 6: Rewrite `.dockerignore`**

Replace the file with:
```
**/node_modules
**/dist
**/*.tsbuildinfo
**/test
**/*.test.ts
.git
.github
.agents
.claude
docs
infra
scripts
load
*.md
.env
.env.*
```
(`packages/db/drizzle/` must remain visible — the migrate image copies it.)

- [ ] **Step 7: Commit**

```bash
git add packages/db docker-compose.yml .dockerignore
git commit -m "feat(db): DB_POOL_MAX knob; compose BIND_HOST for k3d; dockerignore for the v2 tree

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Container images (5 services, web, migrate)

**Files:**
- Create: `apps/auth/Dockerfile`, `apps/event/Dockerfile`, `apps/registration/Dockerfile`, `apps/payment/Dockerfile`, `apps/mail-worker/Dockerfile`, `apps/web/Dockerfile`, `packages/db/Dockerfile`
- Reference pattern: `git show main:apps/registration/Dockerfile` (two compiled binaries), `git show main:apps/web/Dockerfile`, `git show main:packages/db/Dockerfile`.

**Interfaces:**
- Produces image contracts used by the chart and scripts:
  - `eventide/<svc>` (auth, event, registration, payment): `CMD ["./server"]`, listens on `$PORT`, `EXPOSE 3000`, uid 65532.
  - `eventide/auth` additionally ships `/app/promote-admin` (`promote-admin <email>`).
  - `eventide/mail-worker`: `CMD ["./worker"]`, no port.
  - `eventide/web`: `nginxinc/nginx-unprivileged:1.27-alpine`, `:8080`, uid 101, serves `apps/web/dist` with the restored `nginx.conf`.
  - `eventide/db-bootstrap` (name kept — the ECR repo exists): `CMD ["bunx","drizzle-kit","migrate"]`, reads `DATABASE_URL`, uid 1000.
- All builds use the repo root as context: `docker build -f apps/<x>/Dockerfile .`

- [ ] **Step 1: Service Dockerfiles**

For each of auth/event/registration/payment, following `main`'s pattern (build stage `oven/bun:1`, runtime distroless). Manifest copy list for the install layer:
```
COPY package.json bun.lock tsconfig.json ./
COPY packages/db/package.json packages/db/
COPY packages/auth-guard/package.json packages/auth-guard/
COPY packages/mail/package.json packages/mail/
COPY packages/storage/package.json packages/storage/
COPY packages/tickets/package.json packages/tickets/
COPY apps/<svc>/package.json apps/<svc>/
RUN bun install --frozen-lockfile
COPY packages ./packages
COPY apps/<svc> ./apps/<svc>
```
If `bun install --frozen-lockfile` refuses because other workspaces are missing, also COPY every `apps/*/package.json` (web's devDependencies reference the four services). Compile `src/index.ts` → `/app/server`. `auth` additionally compiles `scripts/promote-admin.ts` → `/app/promote-admin` and copies both into the runtime stage.

- [ ] **Step 2: `apps/mail-worker/Dockerfile`**

Same build stage (its manifest list is `packages/mail/package.json` + `apps/mail-worker/package.json`; copying all five packages is fine). Compile `src/index.ts` → `/app/worker`. Runtime distroless, `CMD ["./worker"]`, no `EXPOSE`.

- [ ] **Step 3: `apps/web/Dockerfile`**

Build stage copies `package.json bun.lock tsconfig.json`, every `packages/*/package.json`, every `apps/*/package.json`, installs, copies `packages` + `apps`, runs `cd apps/web && bunx --bun vite build` (no `tsc -b`; CI does `bun check`). Runtime stage = `main`'s (nginx-unprivileged + `apps/web/nginx.conf` + `dist`).

- [ ] **Step 4: `packages/db/Dockerfile` (migrate image)**

```
FROM oven/bun:1-slim
WORKDIR /app
RUN bun add postgres@3.4.9 drizzle-orm@0.45.4 drizzle-kit@0.31.11
COPY packages/db/drizzle.config.ts ./
COPY packages/db/src ./src
COPY packages/db/drizzle ./drizzle
ENV NODE_ENV=production
USER 1000
CMD ["bunx", "drizzle-kit", "migrate"]
```
(Pin the versions to what `bun.lock` resolves: `grep -A1 '"drizzle-kit@' bun.lock` etc.)

- [ ] **Step 5: Build all seven, record sizes**

```bash
for x in auth event registration payment mail-worker web; do docker build -q -f apps/$x/Dockerfile -t eventide/$x:local . || echo "FAILED $x"; done
docker build -q -f packages/db/Dockerfile -t eventide/db-bootstrap:local . || echo "FAILED db-bootstrap"
docker images 'eventide/*' --format '{{.Repository}} {{.Size}}'
```
Expected: 7 images; services roughly 40–70 MB, web < 60 MB, db-bootstrap ~100–150 MB. A compile failure on one image → apply the source-runtime fallback for that image only and note it in the commit body.

- [ ] **Step 6: Health with nothing reachable (Review Focus 2) and a real smoke**

```bash
docker run -d --rm --name h -e PORT=3000 -p 3100:3000 \
  -e DATABASE_URL=postgres://nobody:x@10.255.255.1:5432/nothing -e REDIS_URL=redis://10.255.255.1:6379 \
  -e BETTER_AUTH_SECRET=0123456789012345678901234567890123 -e BETTER_AUTH_URL=http://localhost:3100 \
  -e AUTH_SERVICE_URL=http://10.255.255.1 -e MAIL_QUEUE_URL=http://10.255.255.1/q -e AWS_REGION=us-east-1 \
  -e S3_BUCKET=x -e S3_REGION=us-east-1 eventide/event:local
sleep 2; curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/api/events/health; docker stop h
```
Expected: `200`. Repeat with `eventide/auth:local` and path `/api/auth/health` → `200`. Then with compose up (`bun run infra:up`) and `--network host --env-file .env -e PORT=3002`, `curl localhost:3002/api/events/health` → `โอเค`.

- [ ] **Step 7: Commit**

```bash
git add apps/*/Dockerfile packages/db/Dockerfile
git commit -m "build: Dockerfiles for the v2 services, mail worker, web and the migrate job

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Helm chart for the v2 topology

**Files:**
- Modify: `infra/helm/eventide/values.yaml` (rewrite), `values.local.yaml`, `values.aws.yaml`, `Chart.yaml` (description), `README.md`
- Modify: `templates/deployment.yaml`, `templates/service.yaml`, `templates/ingress.yaml`, `templates/_helpers.tpl`, `templates/externalsecrets.yaml` (only the `eso.secrets` names)
- Create: `templates/files.yaml`, `templates/db-migrate-job.yaml`
- Delete: `templates/db-bootstrap-job.yaml`, `templates/registration-expiry-cronjob.yaml`

**Interfaces:**
- Consumes: image contracts from Task 3.
- Produces (used by Tasks 7/9): k8s Secret names `eventide-common`, `eventide-auth`, `eventide-payment`, `eventide-mail-worker` (created by scripts, not the chart); Services `auth`, `event`, `registration`, `payment`, `web` (port 80), `redis` (port 6379), `files` (ExternalName); value keys below.

- [ ] **Step 1: `values.yaml`**

```yaml
namespace: eventide
publicUrl: http://localhost:8080        # BETTER_AUTH_URL; EKS: https://<domain>
imageRegistry: ""                        # ECR host on EKS, k3d registry locally
imagePullPolicy: IfNotPresent
nodeEnv: production

ingress:
  className: nginx
  host: ""                               # "" = any host (k3d); EKS sets the domain
  proxyBodySize: 20m                     # eventAsset uploads are up to 10 MiB (packages/storage/src/kinds.ts)

# Secret every pod gets (scripts create it): DATABASE_URL, S3_BUCKET, S3_REGION, AWS_REGION,
# AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY/SESSION_TOKEN, MAIL_QUEUE_URL (+ S3_ENDPOINT,
# S3_FORCE_PATH_STYLE, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, SQS_ENDPOINT on k3d).
commonSecretName: eventide-common

# Non-secret env every app pod gets. Templated.
commonEnv:
  REDIS_URL: "redis://redis.{{ .Values.namespace }}.svc.cluster.local:6379"
  AUTH_SERVICE_URL: "http://auth.{{ .Values.namespace }}.svc.cluster.local"
  BETTER_AUTH_URL: "{{ .Values.publicUrl }}"
  DB_POOL_MAX: "4"

# /files/<key> -> <protocol>://<host>:<port>/<bucket>/<key> (ingress-nginx -> S3 / MinIO).
# Only public/* is readable: the bucket policy decides, not the ingress.
files:
  host: host.k3d.internal
  port: 9000
  protocol: HTTP
  bucket: event-assets

# pre-install/pre-upgrade hook: `drizzle-kit migrate` against DATABASE_URL (commonSecretName).
dbMigrate:
  enabled: true
  image: { repository: eventide/db-bootstrap, tag: latest }

eso:                                     # unchanged semantics, off in the lab (SYSTEM-DESIGN §5.2.1)
  enabled: false
  createClusterSecretStore: true
  storeName: eventide-secretstore
  region: us-east-1
  serviceAccount: ""
  refreshInterval: 1h
  secrets:
    eventide-common: eventide/common
    eventide-auth: eventide/auth
    eventide-payment: eventide/stripe
    eventide-mail-worker: eventide/gmail

defaults:
  replicas: 2
  resources:
    requests: { cpu: 50m, memory: 96Mi }
    limits: { cpu: 300m, memory: 256Mi }
  runAsUser: 65532
  readOnlyRootFs: true

services:
  auth:
    port: 3000
    ingressPaths: [/api/auth]
    livePath: /api/auth/health
    readyPath: /api/auth/health
    image: { repository: eventide/auth, tag: latest }
    secretName: eventide-auth            # BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET
  event:
    port: 3000
    ingressPaths: [/api/events]
    livePath: /api/events/health
    readyPath: /api/events/health
    image: { repository: eventide/event, tag: latest }
    hpa: { enabled: false, minReplicas: 2, maxReplicas: 8, targetCPUUtilizationPercentage: 60 }
  registration:
    port: 3000
    ingressPaths: [/api/regis]
    livePath: /api/regis/health
    readyPath: /api/regis/health
    image: { repository: eventide/registration, tag: latest }
  payment:
    port: 3000
    replicas: 1
    ingressPaths: [/api/payment]
    livePath: /api/payment/health
    readyPath: /api/payment/health
    image: { repository: eventide/payment, tag: latest }
    secretName: eventide-payment         # STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  mail-worker:                           # no port: Deployment only, no Service/Ingress/probes
    replicas: 1
    image: { repository: eventide/mail-worker, tag: latest }
    secretName: eventide-mail-worker     # GMAIL_USER, GMAIL_APP_PASSWORD, MAIL_FROM
    resources:
      requests: { cpu: 10m, memory: 48Mi }
      limits: { cpu: 100m, memory: 128Mi }
  redis:                                 # 60 s session cache + revoked markers; loss is harmless
    port: 6379
    servicePort: 6379
    replicas: 1
    tcpProbe: true
    noCommonEnv: true
    runAsUser: 999
    readOnlyRootFs: false
    image: { repository: redis, tag: 8-alpine, external: true }
    args: ["--save", "", "--appendonly", "no"]
    resources:
      requests: { cpu: 10m, memory: 32Mi }
      limits: { cpu: 100m, memory: 96Mi }
  web:
    port: 8080
    servicePort: 80
    replicas: 1
    runAsUser: 101
    readOnlyRootFs: false
    noCommonEnv: true
    ingressPaths: ["/"]
    image: { repository: eventide/web, tag: latest }
    livePath: /
    readyPath: /
    resources:
      requests: { cpu: 10m, memory: 24Mi }
      limits: { cpu: 100m, memory: 64Mi }
```

- [ ] **Step 2: `values.local.yaml` and `values.aws.yaml`**

local: `publicUrl: http://localhost:8080`, `imageRegistry: "eventide-registry:5111"`, `defaults.replicas: 1`, `files: { host: host.k3d.internal, port: 9000, protocol: HTTP, bucket: event-assets }`, `services.event.hpa.enabled: false`, `eso.enabled: false`.
aws: keep the existing ESO comment; `defaults.replicas: 2`; `services.event.hpa.enabled: true`; `files: { host: s3.us-east-1.amazonaws.com, port: 443, protocol: HTTPS, bucket: SET-BY-DEPLOY-SH }` (deploy.sh passes `--set files.bucket=`).

- [ ] **Step 3: Template changes**

`_helpers.tpl` — `eventide.image`: when `.svc.image.external` is true, return `repo:tag` untouched (no registry prefix).

`deployment.yaml` (per service `$svc`):
- `ports:` + `PORT` env + probes only `{{- if $svc.port }}`.
- Probes: `{{- if $svc.tcpProbe }}` → `tcpSocket: { port: http }` for both; else the existing `httpGet` with `livePath`/`readyPath`.
- `args: {{ toJson $svc.args }}` when set.
- env: `NODE_ENV`, then unless `$svc.noCommonEnv`: every `commonEnv` entry via `tpl`; then `$svc.env` as today.
- `envFrom`: unless `$svc.noCommonEnv`, `secretRef: {{ .Values.commonSecretName }}`; plus `$svc.secretName` when set.
- Everything else (spread, securityContext, `/tmp` emptyDir) unchanged.

`service.yaml`: wrap in `{{- if $svc.port }}`; `port: {{ $svc.servicePort | default 80 }}`.

`ingress.yaml`: add `annotations: nginx.ingress.kubernetes.io/proxy-body-size: {{ .Values.ingress.proxyBodySize | quote }}`; the path loop already skips services without `ingressPaths`.

`files.yaml` (new): Service `files` `type: ExternalName`, `externalName: {{ .Values.files.host }}`, one port `{{ .Values.files.port }}`; Ingress `eventide-files` with annotations `use-regex: "true"`, `rewrite-target: /{{ .Values.files.bucket }}/$1`, `backend-protocol: {{ .Values.files.protocol }}`, `upstream-vhost: {{ .Values.files.host }}`, path `/files/(.*)` `pathType: ImplementationSpecific` → `files:{{ .Values.files.port }}`; same `host` rule as the main Ingress.

`db-migrate-job.yaml` (replaces `db-bootstrap-job.yaml`): `{{- if .Values.dbMigrate.enabled }}`, Job `db-migrate`, hooks `pre-install,pre-upgrade`, weight `-5`, delete policy `before-hook-creation,hook-succeeded`, `backoffLimit: 2`, image via `eventide.image` with `dbMigrate.image`, env `DATABASE_URL` from `secretKeyRef {name: commonSecretName, key: DATABASE_URL}`, `runAsUser: 1000`, `readOnlyRootFilesystem: false`.

Delete `registration-expiry-cronjob.yaml` and `db-bootstrap-job.yaml`. `Chart.yaml` description → "The Eventide v2 services (auth, event, registration, payment, mail-worker), Redis, the web SPA and the /files → S3 route — one chart, values.local.yaml for k3d, values.aws.yaml for EKS."

- [ ] **Step 4: Lint and assert the rendered output**

```bash
cd infra/helm/eventide && helm lint . -f values.yaml -f values.local.yaml && helm lint . -f values.yaml -f values.aws.yaml --set files.bucket=b
helm template t . -f values.yaml -f values.aws.yaml --set files.bucket=b > /tmp/aws.yaml
grep -c '^kind: Deployment' /tmp/aws.yaml                               # 7
grep -c '^kind: Service$' /tmp/aws.yaml                                 # 7 (6 ClusterIP + files)
grep -A3 'name: mail-worker' /tmp/aws.yaml | grep -c 'kind: Service'   # 0
grep -c 'path: /api/auth/health' /tmp/aws.yaml                          # 2
grep -c 'tcpSocket' /tmp/aws.yaml                                       # 2
grep 'image: redis:8-alpine' /tmp/aws.yaml                              # present, no registry prefix
grep 'rewrite-target: /b/\$1' /tmp/aws.yaml                             # present
grep 'helm.sh/hook: pre-install,pre-upgrade' /tmp/aws.yaml              # present
grep -c 'proxy-body-size: "20m"' /tmp/aws.yaml                          # 1
grep -c 'CronJob' /tmp/aws.yaml                                         # 0
```
Expected: the counts in the comments.

- [ ] **Step 5: Commit**

```bash
git add infra/helm/eventide
git commit -m "feat(helm): chart for the v2 topology — redis, mail-worker, /files→S3, migrate hook

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Terraform `10-foundation` — mail-worker repo, SQS, public `/files` prefix, Stripe/Gmail secrets

**Files:**
- Modify: `infra/terraform/10-foundation/variables.tf`, `locals.tf`, `secrets.tf`, `s3.tf`, `outputs.tf`, `README.md`
- Create: `infra/terraform/10-foundation/sqs.tf`, `stripe.auto.tfvars.example`, `gmail.auto.tfvars.example`
- Reference: `oauth.tf` (pattern for optional Terraform-managed secrets).

**Interfaces:**
- Produces outputs consumed by `deploy.sh` (Task 7): `ecr_registry`, `uploads_bucket`, `mail_queue_url`, `google_oauth_secret`, `stripe_secret`, `gmail_secret` (secret *names*, `""` when disabled).

- [ ] **Step 1: variables + locals**

`variables.tf`: `services` default → `["auth", "event", "registration", "payment", "mail-worker"]`; `tool_images` stays `["db-bootstrap", "web"]`; delete `uploads_cors_allowed_origins`. `locals.tf`: delete `secret_templates`; keep `uploads_bucket`.

- [ ] **Step 2: secrets.tf → Stripe + Gmail, oauth.tf pattern**

Delete `aws_secretsmanager_secret.service` and its version. Add, each gated like `oauth.tf` (`count = enabled ? 1 : 0`, `recovery_window_in_days = 0`, value fully Terraform-managed):
- `eventide/stripe` from vars `stripe_secret_key` (sensitive), `stripe_webhook_secret` (sensitive); enabled when `stripe_secret_key != ""`; JSON keys `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `eventide/gmail` from vars `gmail_user`, `gmail_app_password` (sensitive), `mail_from` (default `""`); enabled when both of the first two are set; JSON keys `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`.
`*.auto.tfvars.example` for each, mirroring `google.auto.tfvars.example` (where the values come from: Stripe sandbox restricted key `rk_test_…`, webhook endpoint `https://<domain>/api/payment/webhook` → `whsec_…`; Gmail App Password at myaccount.google.com/apppasswords).

- [ ] **Step 3: sqs.tf**

```hcl
resource "aws_sqs_queue" "mail_dlq" { name = "${var.project}-mail-dlq" }

resource "aws_sqs_queue" "mail" {
  name                       = "${var.project}-mail-queue"
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 10
  redrive_policy = jsonencode({ deadLetterTargetArn = aws_sqs_queue.mail_dlq.arn, maxReceiveCount = 5 })
}
```
(mirrors `infra/elasticmq/elasticmq.conf`). Header comment: pods authenticate with the session creds `deploy.sh` injects (no IRSA); fallback if `sqs:CreateQueue` is denied = ElasticMQ pod.

- [ ] **Step 4: s3.tf — public read on `public/*`**

PAB: `block_public_policy = false`, `restrict_public_buckets = false` (ACL blocks stay true). Add:
```hcl
resource "aws_s3_bucket_policy" "uploads_public_prefix" {
  bucket = data.aws_s3_bucket.uploads.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Sid = "PublicReadPublicPrefix", Effect = "Allow", Principal = "*",
    Action = "s3:GetObject", Resource = "${data.aws_s3_bucket.uploads.arn}/public/*" }] })
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}
```
Delete `aws_s3_bucket_cors_configuration.uploads` (uploads go through the service now). Rewrite the header comment: v2 uploads via the owning service, `/files/*` served by ingress-nginx → this bucket; only `public/*` readable.

- [ ] **Step 5: outputs.tf**

Delete `secret_arns`. Add `mail_queue_url = aws_sqs_queue.mail.url`, `stripe_secret` and `gmail_secret` (name or `""`, same `nonsensitive()` shape as `google_oauth_secret`).

- [ ] **Step 6: Validate**

```bash
cd infra/terraform/10-foundation && terraform fmt -check -recursive && terraform init -backend=false -input=false >/dev/null && terraform validate
```
Expected: `Success! The configuration is valid.`

- [ ] **Step 7: README + commit**

Update `10-foundation/README.md` (resources list: 6 ECR repos, SQS ×2, bucket + policy, optional secrets google/stripe/gmail, DNS). Note the apply diff for the next lab session: +1 ECR, +2 SQS, +1 bucket policy, PAB change, −CORS, −4 placeholder secrets.
```bash
git add infra/terraform/10-foundation
git commit -m "feat(tf): foundation for v2 — mail-worker ECR, SQS mail queue, public /files prefix, stripe+gmail secrets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Terraform `20-platform` — one database

**Files:**
- Modify: `infra/terraform/20-platform/rds.tf`, `README.md`

**Interfaces:**
- Produces: secret `eventide/rds-master` JSON keys `username, password, host, port, dbname, DATABASE_URL, BETTER_AUTH_SECRET` (consumed by `deploy.sh`). `DATABASE_URL = postgres://<user>:<pw>@<endpoint>/eventide?sslmode=require`.

- [ ] **Step 1: rds.tf**

Delete `random_password.svc`, `random_password.internal_service`, `random_password.ticket_signing`. Add `db_name = var.project` to `aws_db_instance.main` (changing `db_name` forces replacement — irrelevant, the instance is destroyed every session; say so in the comment). Secret version string → the key set above (`dbname = var.project`). Header comment: v2 = one database, one role; migrations by the chart's `db-migrate` hook.

- [ ] **Step 2: Validate**

```bash
cd infra/terraform/20-platform && terraform fmt -check && terraform init -backend=false -input=false >/dev/null && terraform validate
```
Expected: valid. (`init -backend=false` skips the S3 backend and the remote-state read; validate still type-checks.)

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/20-platform
git commit -m "feat(tf): single eventide database on RDS; slim rds-master secret

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Scripts and Makefile

**Files:**
- Modify: `scripts/deploy.sh`, `scripts/k3d-up.sh`, `scripts/check-lab.sh`, `Makefile`
- Create: `scripts/admin.sh`
- Unchanged: `scripts/teardown.sh`, `scripts/k3d-down.sh`, `load/k6/events.js` (its target `GET /api/events` exists in v2).

**Interfaces:**
- Consumes: Task 4 Secret names/values keys, Task 5/6 outputs, Task 3 image names.
- Produces: `IMAGES="auth event registration payment mail-worker web db-bootstrap"`; `dockerfile_for()` maps `db-bootstrap` → `packages/db/Dockerfile`, else `apps/<x>/Dockerfile`.

- [ ] **Step 1: `scripts/deploy.sh`**

Keep the header, `TAG`, ECR login, kubeconfig. Changes:
- Build + push every image in `IMAGES` via `dockerfile_for`.
- Read `eventide/rds-master` → `DATABASE_URL`, `BETTER_AUTH_SECRET`. Read tf outputs `uploads_bucket`, `mail_queue_url`, `google_oauth_secret`, `stripe_secret`, `gmail_secret`. Session creds via `aws configure export-credentials --format process`.
- Secrets (`mksecret` helper stays):

| Secret | Keys | Source |
|---|---|---|
| `eventide-common` | `DATABASE_URL`, `S3_BUCKET`, `S3_REGION=us-east-1`, `AWS_REGION=us-east-1`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `MAIL_QUEUE_URL` | rds-master, tf outputs, export-credentials |
| `eventide-auth` | `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (last two only when `google_oauth_secret != ""`) | rds-master, Secrets Manager |
| `eventide-payment` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`""` each when `stripe_secret == ""` → payment off) | Secrets Manager |
| `eventide-mail-worker` | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` (`""` when `gmail_secret == ""` → dry-run) | Secrets Manager |

- `helm upgrade --install eventide infra/helm/eventide -f values.yaml -f values.aws.yaml --set imageRegistry=$REG --set publicUrl=$PUBLIC_URL --set files.bucket=$UPLOADS_BUCKET --set dbMigrate.image.tag=$TAG $(--set services.<x>.image.tag=$TAG for auth event registration payment mail-worker web) --wait --timeout 420s`.
- `rollout status` for auth event registration payment mail-worker web redis.
- Closing hints: the four `/api/*/health` curls, `make admin EMAIL=…`.

- [ ] **Step 2: `scripts/k3d-up.sh`**

Keep cluster + ingress-nginx halves. Replace the DB half with `BIND_HOST=0.0.0.0 docker compose up -d`, then the existing `pg_isready` wait loop (service name is `postgres` now, user `postgres`) and `docker compose wait minio-init || true` (one-shot bucket creator; `up --wait` is unreliable with it). No host-side migrate — the chart hook migrates. Build/push every image in `IMAGES` to the k3d registry. Secrets with `H=host.k3d.internal`:
- `eventide-common`: `DATABASE_URL=postgres://postgres:postgres@$H:5432/db`, `S3_ENDPOINT=http://$H:9000`, `S3_FORCE_PATH_STYLE=true`, `S3_REGION=us-east-1`, `S3_BUCKET=event-assets`, `S3_ACCESS_KEY_ID=minioadmin`, `S3_SECRET_ACCESS_KEY=minioadmin`, `AWS_REGION=ap-southeast-1`, `AWS_ACCESS_KEY_ID=local`, `AWS_SECRET_ACCESS_KEY=local`, `SQS_ENDPOINT=http://$H:9324`, `MAIL_QUEUE_URL=http://$H:9324/000000000000/mail-queue`
- `eventide-auth`: `BETTER_AUTH_SECRET=dev-only-insecure-better-auth-secret-0000000`
- `eventide-payment`: `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`
- `eventide-mail-worker`: `GMAIL_USER=`, `GMAIL_APP_PASSWORD=`, `MAIL_FROM=`
Helm with `values.local.yaml`, `--set dbMigrate.image.tag=$TAG` + per-service tags. Smoke hints: the four health curls + `http://localhost:8080`.

- [ ] **Step 3: `scripts/admin.sh`**

```bash
#!/usr/bin/env bash
# Promote a registered user to admin on the running cluster (EKS or k3d). The user
# must have registered through the web first. Uses the auth image that is deployed.
#   bash scripts/admin.sh you@example.com
set -euo pipefail
EMAIL="${1:?usage: admin.sh <email>}"
IMG="$(kubectl -n eventide get deploy auth -o jsonpath='{.spec.template.spec.containers[0].image}')"
kubectl -n eventide run "promote-admin-$(date +%s)" --rm -i --restart=Never --image="$IMG" \
  --overrides="$(jq -cn --arg img "$IMG" --arg email "$EMAIL" \
    '{spec:{containers:[{name:"p",image:$img,command:["/app/promote-admin",$email],
      envFrom:[{secretRef:{name:"eventide-common"}},{secretRef:{name:"eventide-auth"}}]}]}}')"
```

- [ ] **Step 4: `scripts/check-lab.sh`**

Append two probes before the Route 53 block:
```bash
p "SQS  (decides the mail queue: real SQS vs an ElasticMQ pod)"
aws sqs list-queues --output text 2>&1 | tail -2
p "S3 account-level Public Access Block  (decides /files via a public bucket policy)"
aws s3control get-public-access-block --account-id "$(aws sts get-caller-identity --query Account --output text)" 2>&1 | tail -3
echo "NoSuchPublicAccessBlockConfiguration = no account-level block = the public/* bucket policy will apply."
```

- [ ] **Step 5: Makefile**

Targets: `dev` (`bun run infra:up && bun run db:migrate && bun run dev`), `db-reset` (`bun run infra:reset && bun run db:migrate`), `up`, `deploy`, `admin` (`bash scripts/admin.sh $(EMAIL)`), `load`, `down`, `k3d`, `k3d-down`, `help`. Remove `db`, `bootstrap`, `seed`, `smoke`, `seed-eks`, `db-bootstrap`. Keep the `NODE_INSTANCE_TYPE` note on `up`.

- [ ] **Step 6: Syntax check**

Run: `for f in scripts/*.sh; do bash -n "$f" && echo "ok $f"; done; make help`
Expected: `ok` ×7; `make help` lists the 10 targets. If `shellcheck` is installed, run it on the three edited scripts and fix warnings.

- [ ] **Step 7: Commit**

```bash
git add scripts Makefile
git commit -m "feat(scripts): deploy/k3d/admin for the v2 app — common+per-service secrets, migrate hook, SQS probe

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml` (rewrite)

- [ ] **Step 1: Rewrite**

Two jobs, same policy header (checks only; no AWS).
`check` (ubuntu-latest): checkout → `oven-sh/setup-bun@v2` (`bun-version: latest`) → `cp .env.example .env && sed -i 's/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=ci-only-insecure-secret-0123456789abcdef/' .env` → `docker compose up -d` → `until docker compose exec -T postgres pg_isready -U postgres; do sleep 1; done; docker compose wait minio-init || true` → `bun install --frozen-lockfile` → `bun run db:migrate` → `for p in packages/auth-guard packages/storage apps/auth apps/event apps/registration apps/payment; do (cd $p && bun run test) || exit 1; done` → `cd apps/web && bun check && bun run build`.
`images` (matrix `image: [auth, event, registration, payment, mail-worker, web, db-bootstrap]`): checkout → `docker build -f <dockerfile_for> .` (no push; header comment explains why — no OIDC in the lab).

- [ ] **Step 2: Validate YAML**

Run: `python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/ci.yml")); print("yaml ok")'`
Expected: `yaml ok`. (The real run happens on the PR.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: compose-backed tests, web build and image builds for the v2 tree

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: GATE — k3d parity run

**Files:** none new; fixes land in the task that owns the broken file (chart/scripts/Dockerfile) as fix-up commits.

**Prereq:** `k3d`, `helm`, `kubectl` installed; `cp .env.example .env` with a `BETTER_AUTH_SECRET` set.

- [ ] **Step 1: Bring it up**

Run: `make k3d`
Expected: ends with "deployed to k3d"; `kubectl -n eventide get pods` → auth, event, registration, payment, mail-worker, redis, web all `Running`/Ready; `kubectl -n eventide get jobs` → `db-migrate` Complete.

- [ ] **Step 2: Health through the ingress**

```bash
for p in auth events regis payment; do printf '%s ' $p; curl -s localhost:8080/api/$p/health; echo; done
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/
```
Expected: four `โอเค`, then `200`.

- [ ] **Step 3: Cookie session through the ingress (Review Focus 4)**

```bash
curl -s -c /tmp/c -H 'content-type: application/json' localhost:8080/api/auth/sign-up/email \
  -d '{"name":"Gate","email":"gate@example.com","password":"gate-password-123"}' | head -c 200; echo
curl -s -b /tmp/c localhost:8080/api/auth/get-session | head -c 200; echo
```
Expected: sign-up returns the user JSON; `get-session` returns `{"session":…,"user":{…"email":"gate@example.com"…}}`.

- [ ] **Step 4: Upload → `/files` (Review Focus 1 and 3)**

Need a real image between 1 and 2 MiB (avatar max is 2 MiB; the default ingress limit is 1 MiB). ImageMagick: `magick -size 1200x1200 plasma:fractal -quality 95 /tmp/big.jpg` (or `convert …`); otherwise any phone photo. `ls -l /tmp/big.jpg` must show 1–2 MiB. Then (route per `apps/auth/src/routes/avatar`):
```bash
curl -s -b /tmp/c -F file=@/tmp/big.jpg localhost:8080/api/auth/avatar | head -c 300; echo
# take the returned /files/public/users/<id>/avatar/<uuid> path:
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:8080/files/public/users/<id>/avatar/<uuid>
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/files/private/anything
```
Expected: upload 200 with `url: /files/public/users/…`; the GET → `200 image/jpeg`; the private path → `403` (MinIO policy) — never 200. If the upload returns 413, `ingress.proxyBodySize` is not being rendered. (Review Focus 3 at the 10 MiB end: repeat with a 4–9 MiB JPEG against an event's `assets` route once an event exists — optional.)

- [ ] **Step 5: Mail worker (Review Focus 5)**

```bash
curl -s -H 'content-type: application/json' localhost:8080/api/auth/request-password-reset -d '{"email":"gate@example.com","redirectTo":"http://localhost:8080/reset"}'; echo
sleep 12; kubectl -n eventide logs deploy/mail-worker --tail=20
```
Expected: logs contain `GMAIL_USER / GMAIL_APP_PASSWORD not set: mail is logged, not sent`, `Mail worker is polling : http://host.k3d.internal:9324/…`, and a `[dry-run]` line for the reset mail. (If better-auth's path is `/forget-password` on this version, use that.) Pod restarts = 0.

- [ ] **Step 6: Admin promotion**

Run: `make admin EMAIL=gate@example.com`
Expected: `gate@example.com is now an admin.`; `curl -s -b /tmp/c localhost:8080/api/auth/get-session | grep -o '"role":"admin"'` → match.

- [ ] **Step 7: Tear down and commit fix-ups**

Run: `make k3d-down`. Any fix-up commits use the owning task's commit scope (`fix(helm): …`, `fix(scripts): …`).

---

### Task 10: Docs sync (bounded)

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/PROJECT-KNOWLEDGE-BASE.md`, `docs/SYSTEM-DESIGN.md`, `docs/TODO.md`
- Reference: `git show main:CLAUDE.md` (infra sections), v2's `CLAUDE.md` (app sections, already in the tree).

- [ ] **Step 1: `CLAUDE.md`**

Keep v2's file as the body (Project → Frontend). Append, from `main`'s CLAUDE.md, adapted:
- `## Cloud infrastructure` — current state in 5 lines (what exists in `10-foundation`/`20-platform`, chart, scripts; "next lab session: apply 10-foundation diff, apply dns.tf with the real domain, `make up`, `make deploy`").
- `### Read these before doing anything` table (+ `docs/{auth,storage,stripe,tickets}.md`, the spec and plan under `docs/superpowers/`).
- `## The governing principle`, `## Environment constraints` verbatim.
- `## Infra architecture in brief` rewritten for v2: single RDS DB + migrate hook; cookie sessions + `AUTH_SERVICE_URL` + Redis pod; uploads via service, `/files/*` ingress → S3 `public/*`; SQS mail queue + mail-worker (dry-run without Gmail); Stripe (off without keys); ingress-nginx NodePort + Terraform NLB; secrets = `deploy.sh` → 4 k8s Secrets; Terraform split by lifetime.
- `## Tooling / commands` → the new Makefile targets + `bash scripts/check-lab.sh`.
- `## Rules that cause slow, confusing bugs if broken`: keep health-never-touches-DB (now `/api/<prefix>/health`), Elysia chain / TypeBox rules, SIGTERM, DNS/TLS, RDS `skip_final_snapshot`, HPA 8; add `DB_POOL_MAX` and "`/files` is public only under `public/*`"; **drop** the `id` is `text` rule (v2 uses `generateId: "uuid"`) and the "auth_db by better-auth CLI" rule (v2: `packages/db/src/schema/auth.ts`, regenerate with `bunx auth generate`).
- `## Open blockers`, `## Security` verbatim.

- [ ] **Step 2: `AGENTS.md`, `README.md`**

`AGENTS.md`: append the same infra sections (it is the non-Claude mirror). `README.md` (v2's Thai README): add `## Deploy` — 6 lines: k3d parity (`make k3d`), AWS lifecycle (`make up` / `make deploy` / `make admin` / `make down`), pointers to `docs/SYSTEM-DESIGN.md` and `docs/TODO.md`; extend the mermaid diagram with `Redis`, `SQS → mail-worker → Gmail`, `/files → S3`.

- [ ] **Step 3: Knowledge base**

§3 decision log: strike-through + "*Superseded 2026-10-24 by the v2 app*" + new rationale for: one DB per service → one DB (cross-table FKs, engine-enforced boundary dropped for a shipped product); JWKS/bearer → cookie + introspection + Redis cache; presigned uploads → via service + `/files` ingress→S3; "SQS/mail worker/real gateway rejected" → SQS + Stripe built; "Redis rejected" → Redis for session cache only. §2: add "unprobed: `sqs:*`, public bucket policy — `check-lab.sh` probes; fallbacks ElasticMQ pod / stream via `event`". §6: real domain pending (user decision 2026-10-24: real domain; mail/payment dry-run until keys exist).

- [ ] **Step 4: SYSTEM-DESIGN + TODO**

`SYSTEM-DESIGN.md`: insert `## 1.1 Changed in the v2 merge (2026-10-24)` right after §1 — a table of the spec's §2 (what v2 does vs what the infra now does), pointing readers to `docs/superpowers/specs/2026-10-24-v2-infra-merge-design.md`; mark §4 (data), §5.1 (auth), §6 (storage) with a one-line "superseded — see §1.1" banner each.
`TODO.md`: new `## 0.6 V3 — the v2 app on the infra (2026-10-24 →)` with: [x] tasks 1–9 of this plan, [ ] lab session: `check-lab.sh` probes → `terraform apply 10-foundation` → `dns.auto.tfvars` + apply + Cloudflare NS → `make up` → `make deploy` → health/login/upload/mail curls on the NLB → `make down` (**GATE**); [ ] Stripe webhook endpoint + Gmail App Password (optional); [ ] REPORT/DEMO-RUNSHEET v2 pass. Update "Every session start" (`make db-bootstrap` gone; `make admin`).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md README.md docs
git commit -m "docs: sync CLAUDE/AGENTS/README, KB decision log, SYSTEM-DESIGN and TODO to the v2 merge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Push and open the PR

- [ ] **Step 1: Final local checks**

Run: `bun install --frozen-lockfile && (cd packages/db && bun test test/pool.test.ts) && git status --short`
Expected: install clean, test PASS, working tree clean.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/v2-infra
gh pr create --base main --head feat/v2-infra --title "v2 app on the existing infra" --body-file - <<'MD'
## Summary
- Fast-forwards `main` to the v2 app (17 commits from suwizx/v2) and restores the infra tree.
- Adapts infra to v2: one RDS DB + drizzle migrate hook, Redis pod, SQS mail queue + mail-worker, `/files/*` → S3 public prefix, per-service `/api/<prefix>/health` probes, 4 k8s Secrets built by `deploy.sh`.
- App diff: `DB_POOL_MAX` knob, compose `BIND_HOST`, Dockerfiles.
- Spec: `docs/superpowers/specs/2026-10-24-v2-infra-merge-design.md`. Plan: `docs/superpowers/plans/2026-10-24-v2-infra-merge.md`.

## Verified locally
- k3d GATE (Task 9): health ×4, cookie login, 3 MiB upload → `/files`, private key 403, mail-worker dry-run, admin promotion.
- `helm lint`, `terraform validate` ×2, 7 image builds.

## Not yet run (needs a Learner Lab session)
`terraform apply 10-foundation` (+ECR, +SQS, bucket policy, −placeholder secrets), `dns.tf` with the real domain, `make up` / `make deploy` / `make down`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
MD
```
Expected: PR URL printed; CI starts.

---

## Deferred to a lab session (not part of this plan; listed so nothing is forgotten)

1. Paste lab creds; `bash scripts/check-lab.sh` — read the SQS and PAB lines.
2. `terraform -chdir=infra/terraform/10-foundation apply` (expect the diff from Task 5 Step 7). If SQS is denied → ElasticMQ-pod fallback (spec D5). If the bucket policy is denied → stream-via-`event` fallback (spec D6).
3. `dns.auto.tfvars` with the real domain → apply → paste NS into Cloudflare → wait for `ISSUED`.
4. `make up` → `make deploy` → the Task 9 curls against `https://<domain>` → `make admin EMAIL=…` → `make down`.
