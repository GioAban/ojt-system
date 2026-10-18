#!/usr/bin/env bash
# Tinatawag ng GitHub Actions sa server: deploy.sh <image-prefix> <tag> <github-user>
# Ang GitHub token ay galing sa stdin (hindi ito nase-save sa disk).
set -euo pipefail

PREFIX="${1:?image prefix}"
TAG="${2:?tag}"
GH_USER="${3:?github user}"

cd "$(dirname "$0")/.."   # = ~/practicum/deploy

echo "[deploy] login sa ghcr.io"
docker login ghcr.io -u "$GH_USER" --password-stdin

# Itala kung anong version ang tumatakbo (para sa rollback)
export IMAGE_PREFIX="$PREFIX" IMAGE_TAG="$TAG"
touch .deploy-history
echo "$(date -Is) $TAG" >> .deploy-history

COMPOSE="docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml"

echo "[deploy] pull $TAG"
$COMPOSE pull backend web

echo "[deploy] restart"
$COMPOSE up -d --no-build --remove-orphans

echo "[deploy] hintay sa backend (hanggang 60s)"
for i in $(seq 1 30); do
  if $COMPOSE ps --format '{{.Service}} {{.State}}' | grep -q '^backend running'; then break; fi
  sleep 2
done
sleep 5
$COMPOSE ps
$COMPOSE logs --tail=5 backend

docker logout ghcr.io >/dev/null 2>&1 || true
docker image prune -f >/dev/null
echo "[deploy] tapos: $TAG"
