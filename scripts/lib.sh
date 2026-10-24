#!/usr/bin/env bash
# Shared by scripts/deploy.sh and scripts/k3d-up.sh. Tested by scripts/lib.test.sh.

# Dockerfile path for an image name.
dockerfile_for() { case "$1" in db-bootstrap) echo packages/db/Dockerfile ;; *) echo "apps/$1/Dockerfile" ;; esac; }

# helm --set arguments pinning image tags: one per service image in the list,
# plus the migrate Job's when db-bootstrap is in it. Driven by the SAME list the
# build loop uses, so a partial build (IMAGES="event web") never points a
# Deployment at a tag that was not pushed.
#   helm_tag_sets <tag> <image>...
helm_tag_sets() {
  local tag="$1"; shift
  local out=() img
  for img in "$@"; do
    case "$img" in
      db-bootstrap) out+=("--set" "dbMigrate.image.tag=$tag") ;;
      *) out+=("--set" "services.$img.image.tag=$tag") ;;
    esac
  done
  echo "${out[*]}"
}

# The chart's deployments that deploy.sh / k3d-up.sh build images for (redis is a public image).
APP_SERVICES="auth event registration payment mail-worker web"

# For a SUBSET build: pin every service NOT in the list to the tag it runs right
# now (a plain --set would reset it to the chart default `latest`, which is never
# pushed), and skip the migrate hook when no migrate image was built.
#   keep_sets <image>...
keep_sets() {
  local out=() s cur
  for s in $APP_SERVICES; do
    case " $* " in *" $s "*) continue ;; esac
    cur="$(kubectl -n eventide get deploy "$s" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | sed 's/.*://')"
    [ -n "$cur" ] && out+=("--set" "services.$s.image.tag=$cur")
  done
  case " $* " in *" db-bootstrap "*) ;; *) out+=("--set" "dbMigrate.enabled=false") ;; esac
  echo "${out[*]}"
}
