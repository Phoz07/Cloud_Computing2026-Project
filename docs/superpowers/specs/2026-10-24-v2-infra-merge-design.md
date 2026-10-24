# Design: merge the `v2` app into `main` and put it on the existing infra

Date: 2026-10-24 · Status: **approved 2026-10-24** · Author: Claude (for Vnntnn)

## 1. Intent

`suwizx/Cloud_Computing2026-Project@v2` is the finished Eventide website (17 commits on top
of `Vnntnn/main@62a61e2`; its first commit deletes the whole tree and re-scaffolds). `main`
holds the graded cloud infrastructure (Terraform `00/10/20`, Helm chart, deploy/teardown/k3d
scripts, docs). The goal: **one `main` that is the v2 app, deployable on the existing EKS /
RDS / ECR / S3 infra with the same session lifecycle (`make up` → `make deploy` → `make down`).**

Why now: the app is done; the remaining grade is infra + report + demo.

## 2. What v2 changed that the infra must absorb

| Area | `main` infra assumed | `v2` app does | Infra consequence |
|---|---|---|---|
| Database | 4 DBs + 4 roles (`auth_db`…), `db-bootstrap` Job creates them | **one** Postgres DB, one `DATABASE_URL`, cross-table FKs (`events.organizer_id → users.id`) | RDS `db_name = eventide`; Job = `drizzle-kit migrate` only; master creds are the app creds |
| Auth between services | JWKS + bearer, stateless | cookie session; `@app/auth-guard` calls `AUTH_SERVICE_URL/api/auth/get-session`, caches 60 s in **Redis** (`Bun.redis`, `REDIS_URL`) | in-cluster `auth` Service URL; **Redis needed** |
| Uploads | presigned PUT, bytes never in cluster | multipart through the owning service, Bun S3 client (`S3_*` env), keys under `public/…`, browser reads `/files/<key>` | pods need S3 creds (already the pattern); **`/files/*` must resolve in prod** |
| Mail | none | `@app/mail` → **SQS** `mail-queue` (+ `mail-dlq`, 5 receives); `apps/mail-worker` consumes, sends via Gmail SMTP | SQS queues in Terraform; worker Deployment (no HTTP); Gmail creds |
| Payment | mock | **Stripe Checkout + webhook** `/api/payment/webhook` | public HTTPS endpoint or `stripe listen` forwarder |
| Health | `/health/live`, `/health/ready` | `GET /api/<prefix>/health` → `โอเค`, touches nothing | probe paths per service |
| Ports/prefixes | 3000, many prefixes | 3001–3004 (honour `PORT`); `/api/auth`, `/api/events`, `/api/regis`, `/api/payment` | ingress paths |
| Tooling | Turborepo, `@eventide/*` | plain Bun workspaces, `@app/*`, `.env` at root, `docker-compose.yml` with Postgres 18 / Redis 8 / ElasticMQ / MinIO | Makefile, CI, Dockerfiles rewritten |
| Dropped by v2 | — | `infra/`, `scripts/`, `Makefile`, `load/`, `docs/*` (except 4 new docs), CI, Dockerfiles | restore from `main`, then adapt |

These contradict five entries in `docs/PROJECT-KNOWLEDGE-BASE.md` (one-DB-per-service, JWKS
auth, presigned uploads, "SQS/mail worker/real gateway rejected", "Redis rejected"). They are
not re-litigated here: the website is done. The plan records them as **superseded
2026-10-24 by the v2 app** in the decision log, with the new rationale.

## 3. Goals / non-goals / anti-goals

**Goals**
- `main` = v2 app + working infra; v2 history preserved (fast-forward, no squash).
- Same session lifecycle and the same `$50` discipline (`20-platform` destroyed nightly).
- Local parity: `make k3d` runs the same chart as EKS (GATE before any AWS session).
- Every AWS-touching step is runnable later with Learner Lab creds; nothing in this work
  needs creds (validate/lint/build/k3d only).

**Non-goals**
- No app feature work; no refactor of v2 code. App diff limited to Dockerfiles, build glue,
  and env-driven runtime knobs (Decision 15) — no behaviour changes.
- No ESO, no IRSA, no CloudFront (all denied in the lab — unchanged).
- No full rewrite of SYSTEM-DESIGN/REPORT — a bounded "changed in v2 merge" sync pass only.

**Anti-goals (failure even if it works)**
- An extra billable resource that survives `make down` (e.g. ElastiCache, a k8s `LoadBalancer`).
- Secrets committed, or lab session tokens pasted into docs/chat.
- A liveness probe that touches Postgres/Redis.

## 4. Constraints (unchanged, load-bearing)

All of CLAUDE.md §"Environment constraints": `$50` cap, no IRSA, no `iam:CreateRole`, SCP
blocks `s3:GetBucketObjectLockConfiguration` (buckets via CLI + `data`), `iam:GetRole voclabs`
denied (raw `aws_eks_*`), no NAT, subnets 1a/b/c, creds expire in 4 h, PG on RDS forces SSL
(`?sslmode=require`), HPA ceiling 8, `t3.small` ≈ 11 pods/node.

**Not yet probed:** `sqs:*`, `s3:PutBucketPolicy` + public-policy in this account. Both get a
line in `scripts/check-lab.sh`; both have a fallback below.

## 5. Decisions (mine unless marked *theirs*)

1. **Merge mechanics.** Branch `feat/v2-infra` from the v2 tip (which already fast-forwards
   `main`). `git checkout main -- <infra paths>` restores `infra/terraform`, `infra/helm`,
   `scripts/{check-lab,deploy,teardown,k3d-up,k3d-down}.sh`, `Makefile`, `load/`,
   `.github/workflows/ci.yml`, `.dockerignore`, `apps/web/nginx.conf`, `apps/*/Dockerfile`
   (as templates), and `docs/` from `main` (v2's `docs/{auth,storage,stripe,tickets}.md` stay).
   Dropped for good: `infra/k8s/` (raw manifests; the chart is the source), `scripts/{smoke.ts,
   seed.sh,screenshots.ts,db-bootstrap.sh}`, the 4-DB `packages/db/scripts/bootstrap.ts`.
   Land via **PR `feat/v2-infra → main`** on `Vnntnn/…`; you merge. *(Push + PR are the only
   outward actions; everything else is local.)*

2. **One database, one role.** RDS creates `eventide` (`db_name`), the app connects as the
   master user. Per-service roles/passwords, `INTERNAL_SERVICE_TOKEN`, `TICKET_SIGNING_SECRET`
   leave `rds.tf`; `BETTER_AUTH_SECRET` stays (generated per rebuild, auth tables are
   recreated too). RDS engine stays `16` (migrations use only `gen_random_uuid()`).
   `ponytail:` single role; split per service only if the rubric asks for least privilege.

3. **Migrations = Helm hook Job.** `packages/db/Dockerfile` → `oven/bun:1-slim` + `drizzle-kit`
   + `packages/db/{drizzle,drizzle.config.ts,src/schema}`; entrypoint `bunx drizzle-kit migrate`.
   The chart's existing `post-install,post-upgrade` hook runs it on every `make deploy`, so the
   separate `make db-bootstrap` step disappears. ECR repo name `db-bootstrap` is kept (renaming
   = destroy/recreate in the never-destroyed layer).

4. **Redis = a pod in the chart** (`redis:8-alpine`, 1 replica, no PVC, `Service redis`).
   It holds a 60 s session cache + revoked markers; losing it on restart means one slow
   request, never a wrong one (auth-guard falls through to `auth`). ElastiCache rejected: one
   more thing to destroy nightly, unprobed permissions, ~\$0.07/session for no demo value.
   `ponytail:` upgrade path = ElastiCache + `REDIS_URL` override in `values.aws.yaml`.

5. **SQS is real AWS** (`10-foundation/sqs.tf`: `mail-queue` + `mail-dlq`, redrive after 5,
   visibility 30 s, long-poll 10 s; output `mail_queue_url`). Pods authenticate with the
   session creds `deploy.sh` already injects for S3 (`AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN`
   — AWS SDK v3 and Bun's S3 client both read them). **Fallback** if `sqs:CreateQueue` is
   denied: `elasticmq` as a pod in the chart, `SQS_ENDPOINT` pointed at it (`values.aws`
   toggle `mail.queue: aws|elasticmq`).

6. **`/files/*` → S3 directly, via a second Ingress.** No app change: `fileUrl()` keeps
   returning `/files/<key>`. Chart adds `Service files` (ExternalName) + Ingress
   `eventide-files` with `rewrite-target /<bucket>/$1`, `upstream-vhost`, `backend-protocol`.
   AWS: host `s3.us-east-1.amazonaws.com`:443 HTTPS; k3d: `host.k3d.internal`:9000 HTTP
   (MinIO). Bucket: policy `s3:GetObject` on `public/*` + PAB `block_public_policy=false,
   restrict_public_buckets=false` (ACL blocks stay). CORS resource dropped (no browser PUTs).
   **Fallback** if a public bucket policy is denied: a ~10-line `GET /api/events/files/*`
   streaming route in `event` using the pod's creds, ingress path `/files` → `event`.

7. **Secrets layout.** `deploy.sh` builds four k8s Secrets each session:
   `eventide-common` (DATABASE_URL, REDIS_URL, S3_BUCKET, S3_REGION, AWS_REGION, AWS_* session
   creds, MAIL_QUEUE_URL, AUTH_SERVICE_URL, BETTER_AUTH_URL), `eventide-auth`
   (BETTER_AUTH_SECRET, GOOGLE_*), `eventide-payment` (STRIPE_SECRET_KEY,
   STRIPE_WEBHOOK_SECRET), `eventide-mail-worker` (GMAIL_USER, GMAIL_APP_PASSWORD, MAIL_FROM).
   Long-lived values live in Secrets Manager in `10-foundation`: `eventide/google-oauth`
   (exists), **new** `eventide/stripe`, `eventide/gmail`, filled from git-ignored
   `*.auto.tfvars` exactly like `oauth.tf`. Empty = feature off (auth email-only, payment
   refuses, mail-worker dry-run logs). The 4 placeholder per-service secrets are removed.
   Chart: every Deployment `envFrom` common + its own.

8. **Chart shape.** `services:` keeps the per-service map; a service without `port` renders
   a Deployment only (no Service/Ingress/probes) — that is `mail-worker`. `redis` is a
   service entry with its own image. Probes: `livePath = readyPath = /api/<prefix>/health`
   (touches nothing — rule kept). Replicas: auth/event/registration 2, payment/web/
   mail-worker/redis 1 → 10 app pods, fits 2 × `t3.small`. `event` HPA 2→8 on AWS only.
   `registration-expiry` CronJob removed (v2 has no expiry job). ESO templates stay, off.

9. **Images.** Same pattern as `main`: `bun build --compile` → distroless, one Dockerfile per
   `apps/{auth,event,registration,payment,mail-worker}`; `apps/web` = `vite build` → nginx-
   unprivileged with the existing `nginx.conf`. Build context = repo root; COPY the five
   `packages/*/package.json` + the app's. **Fallback** per image if a dep refuses to compile
   (Elysia 2 RC / files-sdk / aws-sdk): run from source on `oven/bun:1-slim`.

10. **Stripe webhook on EKS.** Needs a public URL Stripe can reach. With the custom domain
    (`dns.tf`, not yet applied) it is `https://<domain>/api/payment/webhook`. Without it, the
    demo runs `stripe listen --forward-to http://<nlb>/api/payment/webhook` from the laptop
    (the CLI forwards to plain http). *theirs:* which one for the demo.

11. **CI** (checks only, no AWS, unchanged policy): `docker compose up -d` on the runner →
    `bun install` → `bun run db:migrate` → `bun run test` in the 6 packages that have one →
    `cd apps/web && bun check && bun run build` → `docker build` every Dockerfile (no push).

12. **Makefile.** `dev` (compose + migrate + `bun run dev`), `up`, `deploy`, `down`, `k3d`,
    `k3d-down`, `load`. Gone: `bootstrap`, `db-reset`, `seed`, `smoke`, `seed-eks`,
    `db-bootstrap`. `load/k6/events.js` keeps hitting `GET /api/events` (exists in v2).

14. **First admin after each rebuild.** v2 has no seed; the only admin path is
    `apps/auth/scripts/promote-admin.ts` (needs DB + Redis — RDS is private, so in-cluster).
    The auth image gets a second compiled entrypoint `/app/promote-admin` (same trick as
    `main`'s `/app/expire`); `make admin EMAIL=<x>` runs a one-off Job with the auth image,
    `command: ["/app/promote-admin", "<email>"]`, `envFrom` common + auth Secrets. Flow per
    session: register in the web → `make admin EMAIL=…` → approve organizers in the UI.

15. **DB pool size is an env knob.** `packages/db/src/index.ts` becomes
    `postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 10) })` — one line, default
    unchanged for `bun run dev`. Chart sets `DB_POOL_MAX=4`: `db.t3.micro` allows ≈ 87
    connections; at rest 7 pods × 10 = 70 and the HPA load test (13 pods) would hit 130 and
    fail on connections, not CPU. 13 × 4 = 52. `ponytail:` pgbouncer only if 4 proves too low.

13. **Docs sync (bounded).** One CLAUDE.md = v2 app sections + `main` infra/constraints/rules
    (stale "still planned" lines fixed); AGENTS.md mirrors it. KB decision log gains the five
    "superseded" rows. SYSTEM-DESIGN gets a short §"Changed in the v2 merge" (single DB,
    cookie+introspection+Redis, uploads via service + `/files`, SQS mail, Stripe) and the
    diagram is regenerated. TODO gets a "V3 — v2 on infra" section with the GATEs below.

## 6. Verification (all local; AWS steps deferred until you set creds)

- `bun install --frozen-lockfile`; `bun run db:migrate` on compose; the 6 `bun run test`s green.
- `docker build` × 7, note sizes (target: services < 60 MB, like `main`'s 45 MB).
- `helm lint` + `helm template` with `values.local.yaml` and `values.aws.yaml`.
- `terraform fmt -check` + `terraform init -backend=false && terraform validate` in both layers.
- **GATE (k3d):** `make k3d` → `curl localhost:8080/api/{auth,events,regis,payment}/health`
  → `โอเค`; web loads; register + login works through the ingress (cookie); avatar upload →
  `/files/public/users/…` 200 via ingress → MinIO; a password-reset request shows up in
  `mail-worker` logs (dry-run).
- **Deferred to a lab session:** `check-lab.sh` (SQS + bucket-policy probes) → `terraform apply`
  `10-foundation` (+1 ECR repo, 2 SQS queues, bucket policy, 2 secrets, −4 placeholder
  secrets) → `make up` → `make deploy` → same curls against the NLB → `make down`.

Prereqs on this machine: install `k3d`, `helm`, `kubectl` (`k6` optional). Present: docker,
terraform 1.16, bun.

**Known risk, not a question:** CLAUDE.md records `docker push` of a ~150 MB image stalling
over the VPN. The migrate image and any run-from-source fallback are in that size class.
First EKS session: push off-VPN (or lower the MTU) before the deploy GATE, not during it.

## 7. Left to the builder

File-level layout of the chart templates; exact Dockerfile COPY lists; the wording of the
docs sync; commit granularity (aim: restore-infra / dockerfiles / chart / terraform /
scripts+ci / docs).

## 8. Answers from Vnntnn (2026-10-24)

1. **Real domain.** `dns.tf` gets applied with the real domain in the first lab session (zone +
   wildcard ACM, permanent; NS delegation pasted into Cloudflare once). Stripe webhook =
   `https://<domain>/api/payment/webhook`; Google redirect URI on the same host. Until the
   cert is `ISSUED`, `deploy.sh` falls back to `http://<nlb>` as it does today.
2. **Dry run.** No Gmail / Stripe values for now: `eventide/gmail` and `eventide/stripe` are
   created empty; mail-worker logs instead of sending, payment stays off (checkout refuses
   without a key). Filling the two `*.auto.tfvars` later turns them on with no code change.
3. **PR to `main`.** `feat/v2-infra` pushed to `Vnntnn/…`, PR opened, Vnntnn merges.

Status: **approved** → plan in `docs/superpowers/plans/`.
