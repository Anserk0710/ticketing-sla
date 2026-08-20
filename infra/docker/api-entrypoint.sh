#!/bin/sh
set -eu

APP_DIR="/app/apps/api"
SCHEMA="$APP_DIR/prisma/schema.prisma"
PRISMA_CLI="/app/node_modules/prisma/build/index.js"
RETRIES="${DATABASE_BOOTSTRAP_RETRIES:-30}"
DELAY="${DATABASE_BOOTSTRAP_DELAY_SECONDS:-2}"

# Mendukung perintah one-off, misalnya:
# docker compose run --rm api node prisma/seed.js
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

cd "$APP_DIR"

echo "[api-entrypoint] Menyiapkan skema database..."
attempt=1
while ! node "$PRISMA_CLI" db push --skip-generate --schema "$SCHEMA"; do
  if [ "$attempt" -ge "$RETRIES" ]; then
    echo "[api-entrypoint] Database belum siap setelah $RETRIES percobaan." >&2
    exit 1
  fi
  echo "[api-entrypoint] Percobaan $attempt/$RETRIES gagal; ulang dalam ${DELAY}s..." >&2
  attempt=$((attempt + 1))
  sleep "$DELAY"
done

echo "[api-entrypoint] Skema database siap. Menjalankan NestJS..."
exec node "$APP_DIR/dist/main.js"
