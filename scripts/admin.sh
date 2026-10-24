#!/usr/bin/env bash
# Promote a registered user to admin on the running cluster (EKS or k3d). The
# user must have registered through the web first. Runs the auth image's second
# entrypoint (/app/promote-admin, apps/auth/scripts/promote-admin.ts) as a
# one-off pod with the same Secrets the auth Deployment has.
#
#   bash scripts/admin.sh you@example.com      (or: make admin EMAIL=you@example.com)
set -euo pipefail

EMAIL="${1:?usage: admin.sh <email>}"
# Same image, env (REDIS_URL, AUTH_SERVICE_URL, …) and Secrets as the running auth pod.
AUTH_JSON="$(kubectl -n eventide get deploy auth -o json)"
IMG="$(echo "$AUTH_JSON" | jq -r '.spec.template.spec.containers[0].image')"
ENV="$(echo "$AUTH_JSON" | jq -c '.spec.template.spec.containers[0].env')"
kubectl -n eventide run "promote-admin-$(date +%s)" --rm -i --restart=Never --image="$IMG" \
  --overrides="$(jq -cn --arg img "$IMG" --arg email "$EMAIL" --argjson env "$ENV" \
    '{spec:{containers:[{name:"p",image:$img,command:["/app/promote-admin",$email],env:$env,
      envFrom:[{secretRef:{name:"eventide-common"}},{secretRef:{name:"eventide-auth"}}]}]}}')"
