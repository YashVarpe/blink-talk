#!/usr/bin/env bash
# Auto-deploy: run every minute by blinktalk-autodeploy.timer (as deploy).
# If GitHub main has a new commit, deploy it. If that deploy fails, go back to the commit that was running.
#   pause:   touch ~/autodeploy.off      (rollback.sh does this for you)
#   resume:  rm ~/autodeploy.off
#   logs:    journalctl -u blinktalk-autodeploy -n 50
set -uo pipefail
cd /srv/blinktalk

PAUSE="$HOME/autodeploy.off"     # exists = do nothing (freeze, rollback, demo)
FAILED="$HOME/autodeploy.failed" # last commit that failed to deploy, so we don't retry it every minute

[ -e "$PAUSE" ] && exit 0
git fetch -q origin main || { echo "git fetch failed (network?) - will retry next minute"; exit 0; }

TARGET=$(git rev-parse origin/main)
CURRENT=$(git rev-parse HEAD)
[ "$TARGET" = "$CURRENT" ] && exit 0
[ "$TARGET" = "$(cat "$FAILED" 2>/dev/null)" ] && exit 0

echo "new commit on main: ${CURRENT:0:7} -> ${TARGET:0:7}"
if /srv/blinktalk/deploy/deploy.sh main; then
  rm -f "$FAILED"
  exit 0
fi

echo "❌ deploy of ${TARGET:0:7} failed - going back to ${CURRENT:0:7}"
echo "$TARGET" > "$FAILED"
/srv/blinktalk/deploy/deploy.sh "$CURRENT" || echo "❌❌ going back failed too - run rollback.sh by hand"
exit 1
