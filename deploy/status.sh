#!/usr/bin/env bash
# Is everything OK? Read-only: never restarts or changes anything. Run ON THE SERVER as deploy:
#   /srv/blinktalk/deploy/status.sh        → summary + last 50 api log lines
#   /srv/blinktalk/deploy/status.sh 200    → summary + last 200 api log lines
set -uo pipefail   # no -e: one failed check must not hide the rest

APP=/srv/blinktalk
LINES="${1:-50}"
DOMAIN=$(grep '^DOMAIN=' "$APP/.env" 2>/dev/null | cut -d= -f2)

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

echo "== code"
echo "   $(git -C "$APP" log -1 --format='%h %s (%cr)') on $(git -C "$APP" branch --show-current || echo detached)"

echo "== services"
for s in blinktalk-api blinktalk-web caddy; do
  state=$(systemctl is-active "$s")
  since=$(systemctl show "$s" -p ActiveEnterTimestamp --value)
  if [ "$state" = active ]; then printf '   %-14s %s since %s\n' "$s" "$(green active)" "$since"
  else printf '   %-14s %s\n' "$s" "$(red "$state")"; fi
done

echo "== health"
check() {  # check LABEL URL
  if curl -fsS --max-time 5 -o /dev/null "$2"; then echo "   $1 $(green OK)"; else echo "   $1 $(red FAIL)  ($2)"; fi
}
check "api (inside server)  " http://127.0.0.1:8000/api/health
check "web (inside server)  " http://127.0.0.1:3000/
if [ -n "$DOMAIN" ]; then check "public https://$DOMAIN" "https://$DOMAIN/api/health"
else echo "   public: $(red 'DOMAIN is empty in .env') - Caddy will break on its next restart"; fi

echo "== disk + memory"
df -h / | awk 'NR==2 {print "   disk: " $3 " used of " $2 " (" $5 ")"}'
free -h | awk '/^Mem:/ {print "   ram:  " $3 " used of " $2}'

echo "== last $LINES api log lines"
journalctl -q -u blinktalk-api -n "$LINES" --no-pager -o short-iso | sed 's/^/   /'
echo "== last 10 web log lines"
journalctl -q -u blinktalk-web -n 10 --no-pager -o short-iso | sed 's/^/   /'
