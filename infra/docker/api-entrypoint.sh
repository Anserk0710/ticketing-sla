#!/bin/sh
set -eu

APP_DIR="/app/apps/api"
SCHEMA="$APP_DIR/prisma/schema.prisma"
PRISMA_CLI="/app/node_modules/prisma/build/index.js"
UPLOAD_DIR="${UPLOAD_DIR:-$APP_DIR/uploads}"
RETRIES="${DATABASE_BOOTSTRAP_RETRIES:-30}"
DELAY="${DATABASE_BOOTSTRAP_DELAY_SECONDS:-2}"

run_as_node() {
  if [ "$(id -u)" = "0" ]; then
    su-exec node "$@"
  else
    "$@"
  fi
}

exec_as_node() {
  if [ "$(id -u)" = "0" ]; then
    exec su-exec node "$@"
  else
    exec "$@"
  fi
}

mkdir -p "$UPLOAD_DIR"
if [ "$(id -u)" = "0" ]; then
  if ! su-exec node test -w "$UPLOAD_DIR"; then
    chown -R node:node "$UPLOAD_DIR"
  fi
  chmod 755 "$UPLOAD_DIR"
fi

# Mendukung perintah one-off, misalnya:
# docker compose run --rm api node prisma/seed.js
if [ "$#" -gt 0 ]; then
  exec_as_node "$@"
fi

cd "$APP_DIR"

echo "[api-entrypoint] Menerapkan migration database..."
attempt=1
while ! run_as_node node "$PRISMA_CLI" migrate deploy --schema "$SCHEMA"; do
  if [ "$attempt" -ge "$RETRIES" ]; then
    echo "[api-entrypoint] Database belum siap setelah $RETRIES percobaan." >&2
    exit 1
  fi
  echo "[api-entrypoint] Percobaan $attempt/$RETRIES gagal; ulang dalam ${DELAY}s..." >&2
  attempt=$((attempt + 1))
  sleep "$DELAY"
done

echo "[api-entrypoint] Migration database siap. Menjalankan NestJS..."
exec_as_node node "$APP_DIR/dist/main.js"
