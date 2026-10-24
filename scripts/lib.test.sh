#!/usr/bin/env bash
# bash scripts/lib.test.sh — the helm --set list must follow IMAGES, not a fixed list.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

got="$(helm_tag_sets abc event web db-bootstrap)"
want="--set services.event.image.tag=abc --set services.web.image.tag=abc --set dbMigrate.image.tag=abc"
[ "$got" = "$want" ] || { echo "FAIL (subset): got '$got'"; exit 1; }

got="$(helm_tag_sets v1 auth)"
want="--set services.auth.image.tag=v1"
[ "$got" = "$want" ] || { echo "FAIL (no db-bootstrap => no dbMigrate tag): got '$got'"; exit 1; }

echo "lib.test.sh: 2 pass"

# keep_sets: services NOT rebuilt keep their live tag; no db-bootstrap => migrate hook off.
kubectl() { echo "reg/eventide/$5:oldtag"; }   # stub: `kubectl -n eventide get deploy <name> ...`
got="$(keep_sets event)"
want="--set services.auth.image.tag=oldtag --set services.registration.image.tag=oldtag --set services.payment.image.tag=oldtag --set services.mail-worker.image.tag=oldtag --set services.web.image.tag=oldtag --set dbMigrate.enabled=false"
[ "$got" = "$want" ] || { echo "FAIL (keep_sets subset): got '$got'"; exit 1; }
got="$(keep_sets auth event registration payment mail-worker web db-bootstrap)"
[ -z "$got" ] || { echo "FAIL (keep_sets full set must be empty): got '$got'"; exit 1; }
echo "lib.test.sh: 4 pass"
