#!/usr/bin/env bash
# I-load ang dump (.sql.gz) sa MySQL container ng compose.
# Gamit: ./scripts/restore.sh backups/rds-20261020-1000.sql.gz
# BABALA: papalitan nito ang laman ng database na may parehong table.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?Ilagay ang .sql.gz file}"
[ -f "$FILE" ] || { echo "Walang file: $FILE" >&2; exit 1; }
set -a; . ./.env; set +a

read -r -p "I-restore ang $FILE sa '$MYSQL_DATABASE'? Isulat ang YES: " ok
[ "$ok" = "YES" ] || { echo "Kinansela."; exit 1; }

gunzip -c "$FILE" | docker compose exec -T db \
  sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot --default-character-set=utf8mb4 \"\$MYSQL_DATABASE\""
echo "Tapos na ang restore."
