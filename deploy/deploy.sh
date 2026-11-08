#!/usr/bin/env bash
# One-command deploy. Run ON THE SERVER as the deploy user:
#   ssh deploy@<server> /srv/blinktalk/deploy/deploy.sh          → latest main
#   ssh deploy@<server> /srv/blinktalk/deploy/deploy.sh demo     → the "demo" tag (rollback)
set -euo pipefail

APP=/srv/blinktalk
REF="${1:-main}"
cd "$APP"

[ -f .env ] || { echo "❌ $APP/.env is missing - copy .env.example and fill it in first"; exit 1; }

echo "→ fetching code ($REF)"
git fetch -q --all --tags --force
git checkout -q "$REF"
if [ "$REF" = main ]; then git pull -q --ff-only; fi

echo "→ api: python packages"
[ -d api/.venv ] || python3 -m venv api/.venv
api/.venv/bin/pip install -q -r api/requirements.txt

if [ -f web/package.json ]; then
  echo "→ web: npm install + build (takes a minute)"
  (cd web && npm ci --silent && npm run build)
  WEB=blinktalk-web
else
  echo "→ web: no web/package.json on $REF yet - skipping frontend"
  WEB=""
fi

echo "→ restarting services"
sudo systemctl restart blinktalk-api
if [ -n "$WEB" ]; then sudo systemctl restart blinktalk-web; fi

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
echo "→ health check https://$DOMAIN/api/health"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 3 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo "✅ deployed $(git rev-parse --short HEAD) ($REF)"
    exit 0
  fi
  sleep 1
done
echo "❌ /api/health not answering after 10 s - check: journalctl -u blinktalk-api -n 50"
exit 1
