#!/usr/bin/env bash
# Build + migrate + restart. Run as the app user (drtea), from the repo root:
#   sudo -u drtea -H bash /var/www/drtea-app/deploy/deploy.sh
#
# Steps:
#   1. git pull
#   2. pnpm install (frozen lockfile)
#   3. pnpm build (typecheck + all artifacts)
#   4. drizzle push (apply schema changes)
#   5. rsync built static site -> /var/www/drtea
#   6. pm2 reload (zero-downtime)
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/drtea-app}
WEB_DIR=${WEB_DIR:-/var/www/drtea}
ENV_FILE=${ENV_FILE:-${APP_DIR}/.env}

cd "${APP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} — copy deploy/.env.production.example and fill it in." >&2
  exit 1
fi

# Export every KEY=VALUE from the env file for this script + child processes
set -o allexport
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +o allexport

echo "==> Pulling latest"
git fetch --all --prune
git reset --hard origin/$(git rev-parse --abbrev-ref HEAD)

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building all artifacts (typecheck + build)"
pnpm run build

echo "==> Pushing database schema"
pnpm --filter @workspace/db run push

echo "==> Publishing storefront to ${WEB_DIR}"
mkdir -p "${WEB_DIR}"
rsync -a --delete \
  --exclude='.git' --exclude='.DS_Store' \
  artifacts/dr-tea/dist/public/ "${WEB_DIR}/"

echo "==> Reloading API (PM2)"
if pm2 describe drtea-api >/dev/null 2>&1; then
  pm2 reload drtea-api --update-env
else
  pm2 start deploy/ecosystem.config.cjs --env production
fi
pm2 save

echo "==> Done. Health check:"
sleep 2
curl -fsS http://127.0.0.1:8080/api/health || \
  curl -fsS http://127.0.0.1:8080/api/ | head -c 200 || \
  echo "(no /api/health route — check pm2 logs drtea-api if you suspect a problem)"
echo
echo "Live: https://drtea.in"
