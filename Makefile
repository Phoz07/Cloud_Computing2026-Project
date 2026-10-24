.PHONY: dev db-reset tf-init up plan deploy admin load down k3d k3d-down help

# Learner Lab credentials live in infra/aws.env (copy infra/aws.env.example).
# Every AWS target sources it; Terraform and the AWS CLI read the same variables.
AWSENV := set -a; [ -f infra/aws.env ] && . infra/aws.env; set +a;
TF := terraform -chdir=infra/terraform

help: ## list targets
	@grep -hE '^[a-z0-9-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | sort

# --- inner loop (local) ---------------------------------------------------
dev: ## compose (postgres/redis/elasticmq/minio) + migrate + every app in watch mode
	bun run infra:up && bun run db:migrate && bun run dev

db-reset: ## wipe the compose volumes, recreate the database, migrate
	bun run infra:reset && bun run db:migrate

# --- AWS: session lifecycle --------------------------------------------
# NODE_INSTANCE_TYPE=t3.medium for the HPA-to-8 load test (t3.small's ~11-pod
# ceiling is too tight); default t3.small keeps EC2 cost down otherwise.
tf-init: ## create the state bucket if missing + terraform init (idempotent; `up` runs it)
	$(AWSENV) bash scripts/tf-init.sh

up: tf-init ## terraform apply — permanent layer + EKS + RDS + NLB + ingress-nginx; point kubectl at it
	$(AWSENV) $(TF) apply -auto-approve -input=false $(if $(NODE_INSTANCE_TYPE),-var node_instance_type=$(NODE_INSTANCE_TYPE))
	$(AWSENV) aws eks update-kubeconfig --region us-east-1 --name eventide
	$(AWSENV) kubectl get nodes

plan: ## terraform plan (no changes)
	$(AWSENV) $(TF) plan -input=false

deploy: ## build+push the 7 images to ECR, create the k8s Secrets, helm upgrade (migrates first), roll out
	$(AWSENV) bash scripts/deploy.sh

admin: ## promote a registered user to admin on the running cluster — make admin EMAIL=you@example.com
	$(AWSENV) bash scripts/admin.sh $(EMAIL)

load: ## k6 autoscaling load test vs /api/events — pass BASE_URL=http://<nlb-dns>
	BASE_URL="$(BASE_URL)" k6 run load/k6/events.js

down: ## terraform apply platform=false (EKS/RDS/NLB gone, ECR/S3/SQS/DNS stay) + verify — run at EVERY session end
	$(AWSENV) bash scripts/teardown.sh

# --- local parity: k3d running the same Helm chart as EKS ------------
k3d: ## local k3d cluster + ingress-nginx + the eventide chart (values-local)
	bash scripts/k3d-up.sh

k3d-down: ## delete the local k3d cluster + its registry
	bash scripts/k3d-down.sh
