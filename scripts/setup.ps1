$ErrorActionPreference = "Stop"

if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
if (-not (Test-Path apps/web/.env)) { Copy-Item apps/web/.env.example apps/web/.env }

npm install
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres
npm run db:generate
npm run db:push
npm run db:seed

Write-Host "Setup selesai. PostgreSQL host tersedia di 127.0.0.1:5433. Jalankan: npm run dev"
