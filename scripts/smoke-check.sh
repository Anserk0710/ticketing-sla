#!/usr/bin/env sh
set -eu
API_URL=${API_URL:-http://localhost:3000/api/v1}
WEB_URL=${WEB_URL:-http://localhost:5173}

curl --fail --silent --show-error "$API_URL/health/live" >/dev/null
curl --fail --silent --show-error "$API_URL/public/catalog" >/dev/null
curl --fail --silent --show-error "$WEB_URL" >/dev/null
printf 'Smoke check berhasil.\n'
