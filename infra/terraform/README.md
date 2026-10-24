# infra/terraform — the whole AWS side, one root, one state

`terraform apply` here creates everything; `-var platform=false` removes the nightly
part and keeps the rest. Credentials are the only thing you provide.

## 1. Credentials (every session)

```sh
cp infra/aws.env.example infra/aws.env      # once; gitignored
# paste AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN from
# Learner Lab → AWS Details → "AWS CLI:"  (they expire with the 4 h session)
bash scripts/check-lab.sh                   # after every lab reset: role suffixes + permissions change
```

Every Make target and script sources `infra/aws.env`; Terraform and the AWS CLI read
the same variables. Nothing else is hardcoded — the account ID (bucket names, ECR
host) comes from the credentials.

## 2. Session lifecycle

```sh
make up        # tf-init (state bucket + init) → terraform apply → kubeconfig → nodes
make deploy    # 7 images → ECR, k8s Secrets, helm upgrade (db-migrate hook first), roll out
make admin EMAIL=you@example.com   # first admin, after registering in the web
make down      # terraform apply -var platform=false + proof nothing bills — EVERY session end
```

`make plan` previews. `NODE_INSTANCE_TYPE=t3.medium make up` for the HPA load test.

## 3. What is in the state

| Layer | Resources | Lifetime |
|---|---|---|
| Permanent (root files) | 7 × ECR repo + lifecycle (`ecr.tf`); uploads bucket + `public/*` read policy (`s3.tf`); SQS `eventide-mail-queue` + DLQ (`sqs.tf`); optional `eventide/{google-oauth,stripe,gmail}` secrets (`oauth.tf`, `secrets.tf`); optional Route 53 zone + ACM wildcard cert (`dns.tf`) | survives `make down`; ~$1/month |
| Platform (`modules/platform`, `platform.tf`) | EKS control plane + managed add-ons + 2-node group, RDS `db.t3.micro` with the `eventide` database + `eventide/rds-master` secret, Terraform NLB → ingress-nginx NodePorts, ALIAS record, ingress-nginx + metrics-server Helm releases | `platform = true` (default) ↔ `false` via `make up` / `make down` |

Why a toggle and not two roots: the lab auto-stops EC2 only — RDS, the EKS control
plane and the NLB keep billing ($50 cap, ~$1.10/session), so the platform must go
every night while ECR images, uploaded files, the queue and the DNS delegation must
not. One state, one `apply`, and `platform=false` is a normal apply that destroys
exactly the module and the two Helm releases.

## 4. Optional, opt-in files (gitignored `*.auto.tfvars`)

| Copy from | Turns on |
|---|---|
| `dns.auto.tfvars.example` | Route 53 zone for `events.<domain>` + ACM cert → paste `terraform output route53_name_servers` into Cloudflare once; the NLB gets a TLS listener and an ALIAS record on the next `make up`. Stripe's webhook and Google's redirect URI need this HTTPS host. |
| `google.auto.tfvars.example` | Google sign-in (`eventide/google-oauth`). |
| `stripe.auto.tfvars.example` | Stripe Checkout + webhook (`eventide/stripe`); absent = payment off. |
| `gmail.auto.tfvars.example` | Real mail (`eventide/gmail`); absent = mail-worker logs instead of sending. |

## 5. Lab constraints baked in (don't undo)

- `iam:CreateRole` denied → the lab's `LabEksClusterRole` / `LabEksNodeRole` are looked up by regex (`modules/platform/data.tf`); never hardcode the ARNs.
- `iam:GetRole` on `voclabs` denied → raw `aws_eks_cluster` / `aws_eks_node_group`, not `terraform-aws-modules/eks`.
- An org SCP denies `s3:GetBucketObjectLockConfiguration` → the uploads bucket is CLI-created (`terraform_data`) and read as `data "aws_s3_bucket"`; config via granular `aws_s3_bucket_*`.
- No IRSA → pods get the session credentials through the `eventide-common` k8s Secret (`scripts/deploy.sh`), re-created every session.
- Default VPC, subnets `us-east-1a/b/c` only; no NAT.
- RDS: `skip_final_snapshot`, no deletion protection, or `platform=false` fails.

## 6. State

Backend: S3 `eventide-tfstate-<account>` (created by `scripts/tf-init.sh` if missing),
key `eventide/terraform.tfstate`, S3 lockfile locking (no DynamoDB). On 2026-10-24 the
previous two-layer layout's `10-foundation/terraform.tfstate` is carried over once by
`tf-init.sh` (same resource addresses). A teammate's account = a fresh state and a
fresh build from zero, which is the rehearsed path anyway.

## 7. Validate without credentials

```sh
terraform -chdir=infra/terraform init -backend=false && terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform fmt -check -recursive
```
