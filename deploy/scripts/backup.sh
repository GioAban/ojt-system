#!/usr/bin/env bash
# Nightly backup: dump -> gzip -> local (huling 7) -> S3.
# Cron: 0 19 * * * cd /home/ubuntu/practicum/deploy && ./scripts/backup.sh >> backups/backup.log 2>&1
# (19:00 UTC = 03:00 Asia/Manila)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M)"
OUT="backups/practicum-$STAMP.sql.gz"

docker compose exec -T db \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip > "$OUT"

SIZE=$(stat -c%s "$OUT")
if [ "$SIZE" -lt 2000 ]; then
  echo "$(date) BABALA: napakaliit ng backup ($SIZE bytes), hindi ina-upload." >&2
  rm -f "$OUT"
  exit 1
fi

# Huling 7 lang sa disk ng server
ls -1t backups/practicum-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

# S3 (gamit ang AWS CLI container, hindi kailangang mag-install)
docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION="${AWS_REGION:-ap-southeast-1}" \
  -v "$PWD/backups:/backups:ro" amazon/aws-cli \
  s3 cp "/backups/$(basename "$OUT")" "s3://${APP_S3_BUCKET}/${BACKUP_S3_PREFIX:-db-backups}/$(basename "$OUT")" --only-show-errors

echo "$(date) OK $OUT ($SIZE bytes)"
