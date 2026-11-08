#!/usr/bin/env bash
# Roll the server back to the last known-good build (the "demo" git tag). Run ON THE SERVER as deploy:
#   ssh deploy@<server> /srv/blinktalk/deploy/rollback.sh
# Make the tag on your laptop first:  git tag -fa demo -m "known-good" <commit> && git push -f origin demo
set -euo pipefail
cd /srv/blinktalk
git fetch -q --tags --force
git rev-parse -q --verify "refs/tags/demo" >/dev/null || { echo "❌ no 'demo' tag on GitHub yet - nothing to roll back to"; exit 1; }
touch "$HOME/autodeploy.off"   # stop auto-deploy from putting main straight back; rm ~/autodeploy.off to resume
echo "→ auto-deploy paused"
echo "→ rolling back to demo = $(git rev-parse --short 'demo^{commit}')"
exec /srv/blinktalk/deploy/deploy.sh demo
