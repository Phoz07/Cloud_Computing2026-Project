#!/usr/bin/env bash
# Store this Learner Lab session's credentials (infra/aws.env) as GitHub Actions
# secrets, so the deploy job on push to main can reach AWS. The lab has no OIDC
# federation, so short-lived session credentials are the only option — they
# expire with the session (~4 h); re-run this after every Start Lab. Prints
# nothing secret.
#
#   bash scripts/ci-creds.sh           (make ci-creds)
#   bash scripts/ci-creds.sh --deploy  also trigger the deploy now (workflow_dispatch)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/lib.sh"
load_aws_env
for v in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; do
  [ -n "${!v:-}" ] || { echo "$v is empty — paste the Learner Lab credentials into infra/aws.env first"; exit 1; }
done
aws sts get-caller-identity --query Account --output text >/dev/null \
  || { echo "these credentials are not valid (expired session?)"; exit 1; }

for v in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; do
  printf '%s' "${!v}" | gh secret set "$v" >/dev/null
done
echo "GitHub secrets updated: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (valid until this lab session ends)"

if [ "${1:-}" = "--deploy" ]; then
  gh workflow run ci.yml --ref main >/dev/null && echo "deploy triggered: gh run watch"
fi
