#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

[ -f .env ] || cp .env.example .env
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env

npm install
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres
npm run db:generate
npm run db:push
npm run db:seed

printf '\nSetup selesai. PostgreSQL host tersedia di 127.0.0.1:%s. Jalankan: npm run dev\n' "${POSTGRES_HOST_PORT:-5433}"
