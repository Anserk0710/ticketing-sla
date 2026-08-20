$ErrorActionPreference = "Stop"

docker compose run --rm api node prisma/seed.js
