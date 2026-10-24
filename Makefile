.PHONY: dev db-reset up deploy admin load down k3d k3d-down help

TF_PLATFORM := terraform -chdir=infra/terraform/20-platform

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
up: ## apply 20-platform (EKS + RDS + NLB + ingress-nginx), point kubectl at it
	$(TF_PLATFORM) init -input=false
	$(TF_PLATFORM) apply -auto-approve $(if $(NODE_INSTANCE_TYPE),-var node_instance_type=$(NODE_INSTANCE_TYPE))
	aws eks update-kubeconfig --region us-east-1 --name eventide
	kubectl get nodes

deploy: ## build+push the 7 images to ECR, create the k8s Secrets, helm upgrade (migrates first), roll out
	bash scripts/deploy.sh

admin: ## promote a registered user to admin on the running cluster — make admin EMAIL=you@example.com
	bash scripts/admin.sh $(EMAIL)

load: ## k6 autoscaling load test vs /api/events — pass BASE_URL=http://<nlb-dns>
	BASE_URL="$(BASE_URL)" k6 run load/k6/events.js

down: ## destroy 20-platform and verify nothing survived — run at EVERY session end
	bash scripts/teardown.sh

# --- local parity: k3d running the same Helm chart as EKS ------------
k3d: ## local k3d cluster + ingress-nginx + the eventide chart (values-local)
	bash scripts/k3d-up.sh

k3d-down: ## delete the local k3d cluster + its registry
	bash scripts/k3d-down.sh
