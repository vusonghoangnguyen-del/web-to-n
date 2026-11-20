#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -d $1 ]]; then
  echo "Usage: bash ops/restore-check.sh backups/production/to-toan-YYYYMMDDTHHMMSSZ" >&2
  exit 2
fi

backup_dir=$(cd "$1" && pwd)
gzip -t "$backup_dir/database.sql.gz"
gzip -t "$backup_dir/latex-builds.tar.gz"
tar -tzf "$backup_dir/latex-builds.tar.gz" >/dev/null

container="to-toan-restore-$(date +%s)-$$"
password=$(openssl rand -hex 24)
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --network none --name "$container" \
  -e MYSQL_ROOT_PASSWORD="$password" -e MYSQL_DATABASE=to_toan mysql:8.4 >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec -e MYSQL_PWD="$password" "$container" mysql -uroot -e 'SELECT 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ $ready -ne 1 ]]; then
  echo "Temporary MySQL did not become ready." >&2
  exit 1
fi

gzip -dc "$backup_dir/database.sql.gz" | docker exec -i -e MYSQL_PWD="$password" \
  "$container" mysql -uroot to_toan
table_count=$(docker exec -e MYSQL_PWD="$password" "$container" mysql -uroot -N -B \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'to_toan'")
if [[ ! $table_count =~ ^[0-9]+$ || $table_count -lt 1 ]]; then
  echo "Restore failed: no tables found." >&2
  exit 1
fi
printf 'Restore check passed: %s tables and LaTeX archive readable.\n' "$table_count"
