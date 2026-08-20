$ErrorActionPreference = "Continue"

docker compose ps
docker compose logs api --tail=100
docker compose logs postgres --tail=50
docker compose logs web --tail=50
