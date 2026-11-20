#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
backup_root=${BACKUP_DIR:-./backups/production}
mkdir -p "$backup_root"
backup_root=$(cd "$backup_root" && pwd)
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp -d "$backup_root/.incomplete-${stamp}-XXXXXX")
trap 'rm -f "$temporary/database.sql.gz" "$temporary/latex-builds.tar.gz"; rmdir "$temporary" 2>/dev/null || true' EXIT

deploy_env=${DEPLOY_ENV_FILE:-.env.production}
compose=(docker compose --env-file "$deploy_env" -f compose.production.yml)
"${compose[@]}" exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events "$MYSQL_DATABASE"' | gzip > "$temporary/database.sql.gz"
"${compose[@]}" exec -T api tar -C /data -cf - latex-builds | gzip > "$temporary/latex-builds.tar.gz"
gzip -t "$temporary/database.sql.gz"
gzip -t "$temporary/latex-builds.tar.gz"
mv "$temporary" "$backup_root/to-toan-$stamp"
trap - EXIT
printf 'Backup: %s\n' "$backup_root/to-toan-$stamp"
