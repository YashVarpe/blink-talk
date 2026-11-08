#!/usr/bin/env bash
# BlinkTalk API smoke test: hits the main routes and prints PASS / WARN / FAIL.
#
#   api/smoke.sh                                      # local server  (http://127.0.0.1:8000)
#   api/smoke.sh https://64-177-56-221.sslip.io       # the live server
#   api/smoke.sh https://64-177-56-221.sslip.io --full
#
# Default run is safe on the live demo: it sends no emergency alert and stores no messages.
# --full also stores one "[smoke test]" message and spends a few ElevenLabs credits on a new phrase.
# Needs: bash, curl, python3. Exit code 1 if anything FAILs.

BASE="http://127.0.0.1:8000"
FULL=0
for a in "$@"; do
  case "$a" in
    --full) FULL=1 ;;
    http*) BASE="${a%/}" ;;
  esac
done

PASS=0; WARN=0; FAIL=0
SSE_PID=
TMP="$(mktemp -d)"; trap '[ -n "$SSE_PID" ] && kill $SSE_PID 2>/dev/null; rm -rf "$TMP"' EXIT
JSON='content-type: application/json'

ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
warn() { WARN=$((WARN+1)); printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; }

# req METHOD PATH [JSON_BODY]  ->  sets CODE, BODY (file), TIME (seconds), CTYPE, HANDSHAKE
# TIME is server time only: total minus the DNS/TCP/TLS setup, so a slow HTTPS handshake doesn't hide the API speed.
req() {
  local out
  : > "$TMP/body"  # curl creates no file when the server is unreachable
  if [ -n "$3" ]; then
    out=$(curl -s -m 12 -o "$TMP/body" -w '%{http_code} %{time_total} %{time_appconnect} %{content_type}' -X "$1" "$BASE$2" -H "$JSON" -d "$3")
  else
    out=$(curl -s -m 12 -o "$TMP/body" -w '%{http_code} %{time_total} %{time_appconnect} %{content_type}' -X "$1" "$BASE$2")
  fi
  set -- $out
  CODE=$1; local total=$2; HANDSHAKE=$3; CTYPE=$4
  TIME=$(awk -v t="$total" -v a="$HANDSHAKE" 'BEGIN{printf "%.3f", t-a}')
}
ms() { python3 -c "print(int(float('$1')*1000))"; }

echo "Smoke test: $BASE"
if ! curl -s -m 8 -o /dev/null "$BASE/api/health"; then
  echo "  Cannot reach $BASE (server down, wrong URL, or no network). Nothing was tested."
  exit 2
fi

# 1. health
req GET /api/health
if [ "$CODE" = 200 ] && grep -Eq '"ok": *true' "$TMP/body"; then ok "GET /api/health ($(ms "$TIME") ms)"; else bad "GET /api/health -> $CODE"; fi
if awk -v h="$HANDSHAKE" 'BEGIN{exit !(h > 1)}'; then
  warn "HTTPS handshake took $(ms "$HANDSHAKE") ms on a new connection (reused connections skip this). Ask Om to look at Caddy/TLS."
fi

# 2. profile
req GET /api/profile
if [ "$CODE" = 200 ] && grep -q '"name"' "$TMP/body"; then ok "GET /api/profile"; else bad "GET /api/profile -> $CODE (is the real API deployed, not the placeholder?)"; fi

# 3. suggest: exactly 6 phrases, under 5 s (server time, not counting the HTTPS handshake)
req POST /api/suggest '{"transcript":"Are you hungry?","history":[],"localTime":"2026-11-08T09:00:00-05:00"}'
if [ "$CODE" = 200 ]; then
  RES=$(python3 -c "
import json,sys
d=json.load(open('$TMP/body'))
print(len(d['phrases']), d['source'])" 2>/dev/null)
  N=${RES%% *}; SRC=${RES#* }
  if [ "$N" != 6 ]; then bad "POST /api/suggest returned $N phrases, need exactly 6"
  elif python3 -c "import sys; sys.exit(0 if float('$TIME') < 5 else 1)"; then
    if [ "$SRC" = gemini ]; then ok "POST /api/suggest: 6 phrases from gemini in $(ms "$TIME") ms"
    else warn "POST /api/suggest: 6 phrases but source=$SRC (Gemini not live yet?) in $(ms "$TIME") ms"; fi
  else bad "POST /api/suggest took $(ms "$TIME") ms (limit 5000)"; fi
else bad "POST /api/suggest -> $CODE"; fi

# 4. bad input is rejected, not crashed
req POST /api/alert '{"type":"nope"}'
if [ "$CODE" = 422 ]; then ok "POST /api/alert with a bad type -> 422"; else bad "POST /api/alert bad type -> $CODE (want 422)"; fi

# 5. speak: a common phrase (already cached, so no credits spent)
req POST /api/speak '{"text":"Yes"}'
SIZE=$(wc -c < "$TMP/body" | tr -d ' ')
if [ "$CODE" = 200 ] && [[ "$CTYPE" == audio/mpeg* ]] && [ "$SIZE" -gt 1000 ]; then
  ok "POST /api/speak: audio/mpeg, $SIZE bytes, $(ms "$TIME") ms"
elif [ "$CODE" = 503 ]; then bad "POST /api/speak -> 503 (ElevenLabs keys missing or invalid on this server?)"
else bad "POST /api/speak -> $CODE $CTYPE"; fi

# 6. live events: a status change must reach an open /api/events stream
: > "$TMP/sse"
curl -sN -m 15 "$BASE/api/events" > "$TMP/sse" 2>/dev/null &
SSE_PID=$!
# wait (up to 8 s) until the stream is really open, so a slow HTTPS handshake can't cause a false FAIL
for _ in $(seq 1 40); do grep -q ': connected' "$TMP/sse" && break; sleep 0.2; done
if ! grep -q ': connected' "$TMP/sse"; then
  bad "SSE: GET /api/events never opened (events.py missing? Caddy buffering?)"
else
  req POST /api/status '{"state":"active"}'
  STATUS_CODE=$CODE
  for _ in $(seq 1 15); do grep -q 'event: status' "$TMP/sse" && break; sleep 0.2; done
  if [ "$STATUS_CODE" != 204 ]; then bad "POST /api/status -> $STATUS_CODE (want 204)"
  elif grep -q 'event: status' "$TMP/sse"; then ok "SSE: status event reached an open /api/events stream"
  else bad "SSE: stream open but the status event never arrived (Caddy buffering? flush_interval -1?)"; fi
fi
{ kill $SSE_PID; wait $SSE_PID; } 2>/dev/null; SSE_PID=

# --full: writes
if [ "$FULL" = 1 ]; then
  req POST /api/messages '{"role":"caregiver","text":"[smoke test]"}'
  if [ "$CODE" = 200 ]; then
    MID=$(python3 -c "import json; print(json.load(open('$TMP/body'))['id'])")
    req GET '/api/messages?limit=5'
    if grep -q "$MID" "$TMP/body"; then ok "POST + GET /api/messages round trip"; else bad "message $MID not found in GET /api/messages"; fi
  else bad "POST /api/messages -> $CODE"; fi

  req POST /api/speak "{\"text\":\"Smoke test $(date +%s)\"}"
  SIZE=$(wc -c < "$TMP/body" | tr -d ' ')
  if [ "$CODE" = 200 ] && [ "$SIZE" -gt 1000 ]; then
    if python3 -c "import sys; sys.exit(0 if float('$TIME') < 5 else 1)"; then ok "POST /api/speak new phrase via ElevenLabs: $(ms "$TIME") ms"
    else bad "POST /api/speak new phrase took $(ms "$TIME") ms (limit 5000)"; fi
  else bad "POST /api/speak new phrase -> $CODE"; fi
fi

echo
printf 'Result: %d passed, %d warnings, %d failed\n' "$PASS" "$WARN" "$FAIL"
[ "$FAIL" = 0 ]
