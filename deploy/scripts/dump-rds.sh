#!/usr/bin/env bash
# Kumuha ng kopya ng database mula sa RDS papunta sa file (backups/rds-YYYYmmdd-HHMM.sql.gz).
# Patakbuhin sa Lightsail (kailangang payagan ng Security Group ng RDS ang static IP ng Lightsail sa port 3306).
# Gamit: RDS_HOST=xxxx.rds.amazonaws.com RDS_USER=admin RDS_DB=practicum ./scripts/dump-rds.sh
# Ipapatanong ang password (hindi ito nase-save sa history).
set -euo pipefail

: "${RDS_HOST:?Ilagay ang RDS_HOST}"
: "${RDS_USER:?Ilagay ang RDS_USER}"
: "${RDS_DB:?Ilagay ang RDS_DB}"

read -r -s -p "RDS password: " RDS_PASSWORD
echo
mkdir -p backups
OUT="backups/rds-$(date +%Y%m%d-%H%M).sql.gz"

docker run --rm -e MYSQL_PWD="$RDS_PASSWORD" mysql:8.4 \
  mysqldump -h "$RDS_HOST" -u "$RDS_USER" \
  --single-transaction --routines --triggers --no-tablespaces \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 \
  "$RDS_DB" | gzip > "$OUT"

# Siguraduhing hindi walang laman at may mga table
SIZE=$(stat -c%s "$OUT")
if [ "$SIZE" -lt 2000 ]; then
  echo "BABALA: napakaliit ng dump ($SIZE bytes). Tingnan kung tama ang host/user/password." >&2
  exit 1
fi
echo "OK: $OUT ($SIZE bytes)"
