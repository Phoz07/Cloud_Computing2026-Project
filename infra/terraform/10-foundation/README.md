# 10-foundation — durable AWS resources

**Lifetime: permanent.** Never in the nightly `terraform destroy`. Costs ~$1/month
(ECR + S3 storage, SQS is free at this volume, Secrets Manager $0.40/secret/month
for whichever of google/stripe/gmail are enabled). Holds the things that must
survive a platform teardown — pushed images, uploaded files, third-party secrets.

| Resource | Why it lives here |
|---|---|
| 7 × ECR repo (`eventide/{auth,event,registration,payment,mail-worker,web,db-bootstrap}`) | Images built per session must outlast the cluster. |
| S3 uploads bucket (`eventide-uploads-<account>`) + `public/*` read policy | Uploaded avatars / event images; `/files/*` is served from here by the ingress (`s3.tf`). |
| SQS `eventide-mail-queue` + `eventide-mail-dlq` (`sqs.tf`) | The mail queue `@app/mail` writes to and `apps/mail-worker` drains; stable URL across rebuilds. |
| `eventide/stripe`, `eventide/gmail` secrets (`secrets.tf`, opt-in) | Stripe + Gmail credentials, Terraform-managed from `stripe.auto.tfvars` / `gmail.auto.tfvars`. Absent = payment off / mail dry-run. |
| Route 53 hosted zone + ACM wildcard cert (`dns.tf`, opt-in) | The zone's NS records are delegated from Cloudflare **by hand, once** — recreating the zone changes the NS set and breaks the delegation. The cert DNS-validates once and is reused across every platform rebuild. |
| `eventide/google-oauth` secret (`oauth.tf`, opt-in) | Google OAuth client id/secret — stable across rebuilds, Terraform-managed from `google.auto.tfvars`. `scripts/deploy.sh` merges it into `eventide-auth`. |

## Prerequisites

1. `../00-bootstrap/README.md` — the state bucket must exist.
2. Lab session credentials in `~/.aws/credentials` (they expire every 4 hours).
3. `terraform` ≥ 1.10 (`brew install terraform`).

## Apply

```bash
terraform -chdir=infra/terraform/10-foundation init
terraform -chdir=infra/terraform/10-foundation fmt -check
terraform -chdir=infra/terraform/10-foundation plan
terraform -chdir=infra/terraform/10-foundation apply
```

**GATE (docs/TODO.md §2 Day 1):**

```bash
aws ecr describe-repositories --query 'repositories[].repositoryName'
aws secretsmanager list-secrets --query 'SecretList[].Name'
```

ECR must list the seven `eventide/*` repos; `aws sqs list-queues` the two queues.

**v2 merge (2026-10-24) — expected diff on the next apply** against the state applied
2026-09-07: +1 ECR repo (`mail-worker`), +2 SQS queues, +1 bucket policy, the Public
Access Block loosened for policies, −1 CORS configuration, −4 placeholder
`eventide/{auth,event,registration,payment}` secrets (they held `REPLACE_ME` only).
`bash scripts/check-lab.sh` first: it probes `sqs:ListQueues` and the account-level
Public Access Block, the two things this layer now assumes.

## Stripe and Gmail (`secrets.tf`) — optional, opt-in

Same shape as Google OAuth below: a gitignored `*.auto.tfvars` is the source of truth,
Terraform owns the secret value, `scripts/deploy.sh` injects it on the next `make deploy`.

```bash
cp stripe.auto.tfvars.example stripe.auto.tfvars   # rk_test_… + whsec_…  (docs/stripe.md)
cp gmail.auto.tfvars.example gmail.auto.tfvars     # Gmail address + App Password
terraform -chdir=infra/terraform/10-foundation apply
```

Leave them unset for a dry run: checkout answers "payment disabled", the mail worker
logs each mail instead of sending it.

## Custom domain (`dns.tf`) — optional, opt-in

Off unless `dns_domain` is set. `events.<domain>` is delegated to a Route 53 hosted
zone; the apex stays on Cloudflare (SYSTEM-DESIGN.md §5.5.1 option 2).

```bash
cp dns.auto.tfvars.example dns.auto.tfvars     # gitignored; set dns_domain
terraform -chdir=infra/terraform/10-foundation apply
terraform -chdir=infra/terraform/10-foundation output route53_name_servers
```

Paste those **4 NS records** into Cloudflare as `NS` records on the name `events`
(type NS, one row per server, not proxied). Then wait for propagation and check:

```bash
dig +short NS events.<domain>                  # should return the Route 53 servers
aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='events.<domain>']"
aws acm describe-certificate --region us-east-1 --certificate-arn "$(
  terraform -chdir=infra/terraform/10-foundation output -raw acm_certificate_arn)" \
  --query 'Certificate.Status'                 # PENDING_VALIDATION -> ISSUED
```

The cert issues on ACM's own retry once the NS delegation resolves — no second
apply. `20-platform` then picks up the zone ID + cert ARN from this layer's
remote state on the next `make up` and wires the NLB TLS listener + ALIAS record.

**This layer is never destroyed**, so the zone and its NS delegation are set once
and survive every nightly platform rebuild.

## Google OAuth (`oauth.tf`) — optional, opt-in

Off unless `google_client_id` + `google_client_secret` are set. When set, Terraform
creates the `eventide/google-oauth` secret; `scripts/deploy.sh` reads it into the
`eventide-auth` k8s Secret on the next `make deploy`.

```bash
cp google.auto.tfvars.example google.auto.tfvars   # gitignored; paste the client creds
terraform -chdir=infra/terraform/10-foundation apply
```

Register the redirect URI in Google Cloud Console (exact match, HTTPS, no wildcard):
`https://events.<domain>/api/auth/callback/google` and (for dev)
`http://localhost:3000/api/auth/callback/google`. Consent screen → **In production**,
scopes limited to `openid` / `email` / `profile` (SYSTEM-DESIGN §5.1.1).

## Overrides

Defaults target Learner Lab account `735838417080` / `us-east-1`. For a teammate's
account, either edit `variables.tf` defaults or pass `-var`:

```bash
terraform -chdir=infra/terraform/10-foundation apply \
  -var account_id=<id> -var region=us-east-1
```

...and update the `bucket` in `versions.tf` + re-run `00-bootstrap` there first.
