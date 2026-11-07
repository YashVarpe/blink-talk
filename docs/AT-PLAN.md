# AT — Plan of Action (infra, deploy, live events)

## What my part is, in one paragraph

I make BlinkTalk **reachable, secure, live and reliable**. I run the one Vultr server that hosts everything, give it a public
**HTTPS** URL (camera and mic don't work without it, so this blocks the whole team), deploy the Next.js frontend and the FastAPI
backend as services that survive crashes and reboots, keep the API keys safe, and build the **live event stream (SSE)** that
pushes messages, emergency alerts and status from the patient's screen to the caregiver's phone in real time. On demo day I own
uptime, latency numbers, and the one-command rollback.

## My deliverables

| # | Deliverable | File(s) | Who depends on it | Due |
|---|---|---|---|---|
| 1 | Vultr server + deploy user + firewall | `deploy/setup.sh` | everyone | first hour |
| 2 | Domain + automatic HTTPS (Caddy) | `deploy/Caddyfile` | everyone (camera/mic) | **Sat 6:30 PM** |
| 3 | api + web as restart-on-failure services | `deploy/blinktalk-api.service`, `deploy/blinktalk-web.service` | everyone | Sat 6:30 PM |
| 4 | One-command deploy | `deploy/deploy.sh` | everyone | Sat 6:30 PM |
| 5 | Secrets on server, key names in repo | `/srv/blinktalk/.env`, `.env.example` | Om, Yash | Sat 6:30 PM |
| 6 | SSE broadcaster | `api/events.py` | Om (publishes), Yudi (caregiver view listens) | Sat 8:00 PM |
| 7 | Health + status tooling | `/api/health`, `deploy/status.sh` | me, judges' demo | Sat 9:00 PM |
| 8 | Light rate limits on `/suggest`, `/speak` | Caddy or `api/` middleware (with Om) | protects API credits | Sat night |
| 9 | Device testing + latency numbers | notes → Yudi for `/results` | Yudi | Sun 9:00 AM |
| 10 | `demo` tag + one-command rollback | `deploy/rollback.sh` | everyone | **Sun 10:00 AM** |
| 11 | Redeploy runbook | `deploy/README.md` | anyone at 4 AM | ongoing |

**Decision:** systemd, not docker compose. Fewer layers, faster to debug, survives reboot, one place for logs (`journalctl`).

---

## Architecture (what I'm building)

```
 iPad / laptop (patient)                       phone (caregiver)
   camera → MediaPipe (in browser, frames never leave)      ▲
   │  POST /api/suggest, /api/speak, /api/messages,         │ EventSource('/api/events')
   │       /api/alert, /api/status                          │  events: message | alert | status
   ▼                                                        │
 ┌──────────────────────── Vultr (Ubuntu LTS) ──────────────┴───────┐
 │  Caddy :443 (auto HTTPS, $DOMAIN)                                  │
 │    /api/*  → uvicorn :8000  (FastAPI, 1 worker, flush_interval -1) │
 │    else    → next start :3000                                      │
 │  api/events.py: in-memory set of asyncio.Queue  ← publish() by Om  │
 │  /srv/blinktalk/.env (secrets)   SQLite + audio_cache on disk      │
 └────────────────────────────────────────────────────────────────────┘
```

Why **1 uvicorn worker**: SSE subscribers live in that process's memory. With 2 workers, a `publish()` on worker A would never reach a
caregiver connected to worker B.

---

## Phase 1 — Server + HTTPS (first hour, BLOCKING for everyone)

Branch: `at/server-setup`

### 1.1 Create the Vultr instance
- Vultr dashboard → Cloud Compute → Ubuntu 24.04 LTS, 2 vCPU / 4 GB (Next.js build needs the RAM), region closest to Buffalo (New York / NJ).
- Add my SSH public key at creation. Note the IP.

### 1.2 `deploy/setup.sh` (run once as root)
```bash
#!/usr/bin/env bash
set -euo pipefail
# firewall: only 22, 80, 443
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# deploy user with my ssh key
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
# runtimes
apt-get update && apt-get install -y git python3-venv python3-pip debian-keyring debian-archive-keyring apt-transport-https curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
# caddy (official apt repo)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
# app dir
mkdir -p /srv/blinktalk && chown deploy:deploy /srv/blinktalk
sudo -u deploy git clone https://github.com/tupe-atharva/blink-talk.git /srv/blinktalk
# let deploy restart our services without a password
echo 'deploy ALL=NOPASSWD: /usr/bin/systemctl restart blinktalk-api, /usr/bin/systemctl restart blinktalk-web, /usr/bin/systemctl reload caddy' > /etc/sudoers.d/blinktalk
```
Optional hardening if time: `PasswordAuthentication no` and `PermitRootLogin no` in `/etc/ssh/sshd_config`.

### 1.3 Domain
- First choice: hackathon/MLH domain → add an `A` record pointing at the server IP.
- Fallback (zero setup, works instantly): `<ip-with-dashes>.sslip.io`, e.g. `45-77-1-2.sslip.io`. Let's Encrypt accepts it.

### 1.4 `deploy/Caddyfile` → `/etc/caddy/Caddyfile`
```
{$DOMAIN} {
  encode gzip
  handle /api/* {
    reverse_proxy localhost:8000 {
      flush_interval -1        # SSE: never buffer
    }
  }
  handle {
    reverse_proxy localhost:3000
  }
}
```
`DOMAIN` reaches Caddy through a systemd drop-in: `/etc/systemd/system/caddy.service.d/env.conf` with
`[Service]\nEnvironmentFile=/srv/blinktalk/.env`. Then `systemctl daemon-reload && systemctl restart caddy`.
(Note: `encode gzip` may buffer SSE — if events arrive late, remove it from the `/api/*` path first.)

### 1.5 Placeholder apps so HTTPS can go live before real code exists
Until Om and Yudi merge, run a tiny FastAPI with `/api/health` and a `next` hello page. This lets the team test camera
permission on the real URL **before** the real app exists.

**Done when:** `https://$DOMAIN` loads with a padlock on my phone, `curl https://$DOMAIN/api/health` → `{"ok":true}`.
→ Post URL in group chat and pin it.

---

## Phase 2 — Services + one-command deploy (by Sat 6:30 PM)

Branch: `at/services`

### 2.1 `deploy/blinktalk-api.service`
```ini
[Unit]
Description=BlinkTalk API
After=network.target

[Service]
User=deploy
WorkingDirectory=/srv/blinktalk/api
EnvironmentFile=/srv/blinktalk/.env
ExecStart=/srv/blinktalk/api/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1 --timeout-graceful-shutdown 3
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

### 2.2 `deploy/blinktalk-web.service`
Same shape: `WorkingDirectory=/srv/blinktalk/web`, `ExecStart=/usr/bin/npm run start -- -p 3000 -H 127.0.0.1`,
`Environment=NODE_ENV=production`.

Install both: `cp deploy/*.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now blinktalk-api blinktalk-web`.

### 2.3 `deploy/deploy.sh` (run as `deploy`)
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /srv/blinktalk
REF="${1:-main}"                      # deploy.sh            → latest main
git fetch --all --tags                # deploy.sh demo       → the demo tag
git checkout -q "$REF" && { [ "$REF" = main ] && git pull -q --ff-only || true; }
# api
[ -d api/.venv ] || python3 -m venv api/.venv
api/.venv/bin/pip install -q -r api/requirements.txt
# web
cd web && npm ci --silent && npm run build && cd ..
sudo systemctl restart blinktalk-api && sudo systemctl restart blinktalk-web
sleep 3 && curl -fsS "https://$(grep ^DOMAIN= .env | cut -d= -f2)/api/health" && echo "  ✅ deployed $(git rev-parse --short HEAD)"
```

### 2.4 Secrets
- `/srv/blinktalk/.env`, `chmod 600`, owner `deploy`. Fill from the keys Om/Yash got.
- `.env.example` in git lists names only (already done).
- Share real values with teammates by DM only.

**Done when:** `sudo reboot` → after ~1 min, the site and `/api/health` are back on their own.

---

## Phase 3 — `api/events.py` SSE broadcaster (by Sat 8:00 PM)

Branch: `at/sse`

```python
# api/events.py
import asyncio, json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()
_subscribers: set[asyncio.Queue] = set()

def publish(event: str, data: dict) -> None:
    """Called by Om's routes: publish("message" | "alert" | "status", data). Never blocks."""
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass  # slow client: drop, don't block the publisher

@router.get("/api/events")
async def events(request: Request):
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)

    async def stream():
        try:
            yield ": connected\n\n"
            while not await request.is_disconnected():
                try:
                    yield await asyncio.wait_for(q.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"     # keeps proxies + phones from killing the connection
        finally:
            _subscribers.discard(q)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

**Integration (agree with Om):**
- Om adds `app.include_router(events.router)` in `main.py` and calls `publish(...)` in `POST /api/messages`, `/api/alert`, `/api/status`.
- Payloads exactly as in `CLAUDE.md`: `message` = `Message`, `alert` = `{type, ts}`, `status` = `{state, ts}`.
- Until Om's routes exist, I add a dev-only `POST /api/_debug/publish` to test end-to-end (remove before freeze).

**Integration (tell Yudi):** caregiver view does
```ts
const es = new EventSource("/api/events");
es.addEventListener("alert", e => { const a = JSON.parse(e.data); /* full-screen red + sound */ });
es.addEventListener("message", e => ...); es.addEventListener("status", e => ...);
// EventSource auto-reconnects; show a "reconnecting…" badge on es.onerror
```

**Test:**
```bash
curl -N https://$DOMAIN/api/events                     # terminal 1: should print ": ping" every 15 s
curl -X POST https://$DOMAIN/api/alert -H 'content-type: application/json' -d '{"type":"emergency"}'   # terminal 2
# terminal 1 must show the event within < 1 s
```
Also test: 3 caregiver tabs open at once all receive it; close a tab → subscriber count drops (no leak).

---

## Phase 4 — Reliability + protection (Sat night)

Branch: `at/reliability`

- **`/api/health`** — returns `{ "ok": true }` (coordinate with Om; I can add it in `events.py` router if he hasn't).
- **External uptime check** — free UptimeRobot (or a cron `curl` on my laptop) hitting `/api/health` every minute → phone alert.
- **`deploy/status.sh`**
  ```bash
  #!/usr/bin/env bash
  systemctl --no-pager --lines=0 status caddy blinktalk-api blinktalk-web | grep -E '●|Active'
  echo "--- api logs ---";  journalctl -u blinktalk-api -n 50 --no-pager
  echo "--- web logs ---";  journalctl -u blinktalk-web -n 20 --no-pager
  echo "--- disk ---";      df -h / | tail -1;  du -sh /srv/blinktalk/api/audio_cache
  ```
- **Rate limits** (protect Gemini/ElevenLabs credits): simplest is a small in-memory per-IP limiter as FastAPI middleware for
  `/api/suggest` (~30/min) and `/api/speak` (~20/min), returning `429`. Coordinate with Om since it touches `main.py`.
  Caddy doesn't rate-limit without a plugin — don't spend time building a custom Caddy.
- **Never log API keys:** check uvicorn logs don't print request headers; Om's code must not `print(os.environ)`.
- **Log rotation:** journald handles it; cap with `SystemMaxUse=200M` in `/etc/systemd/journald.conf`.
- **Vultr snapshot** of the server once it works (one click in dashboard) — the ultimate rollback.

---

## Phase 5 — Real-device testing + latency (Sat 9 PM → Sun 9 AM)

On venue Wi-Fi, on the real URL:

| Device | Check | Pass? |
|---|---|---|
| iPad (Safari) | Camera permission prompt appears, video shows, face tracks | |
| iPhone (Safari) | Mic permission for caregiver STT (Safari support for Web Speech is limited — tell Yash early if it fails) | |
| Laptop (Chrome) | Camera + mic, talk board works | |
| Phone as caregiver | `alert` arrives in < 1 s; reconnects after toggling airplane mode | |
| Phone screen locked 2 min | On unlock, EventSource reconnects and shows latest state | |

**Latency (with Om):** measure "caregiver stops talking → audio starts playing". Log `performance.now()` at STT final, at `/suggest`
response, at tile select, at first audio byte. Run 10 trials, report **median and p90** for each leg to Yudi for `/results`.
Also measure SSE delivery time (publish → caregiver receives).

Hedge: if venue Wi-Fi blocks something, have a phone hotspot ready as backup network for the demo.

---

## Phase 6 — Freeze, tag, rollback (before Sun 10:00 AM)

```bash
# on my laptop, once main is verified on the server
git checkout main && git pull
git tag -a demo -m "known-good demo build" && git push origin demo
```

`deploy/rollback.sh`:
```bash
#!/usr/bin/env bash
exec /srv/blinktalk/deploy/deploy.sh demo
```

- Test the rollback **once** before 10 AM (deploy main → rollback → confirm site works).
- After freeze: every fix needs a 👍 in chat, then I re-tag: `git tag -fa demo -m ... && git push -f origin demo` (only the tag, never main).
- Take a second Vultr snapshot of the frozen server.

---

## Phase 7 — Demo + submission (Sun until 2:30 PM)

- 30 min before judging: `status.sh`, restart services fresh, open caregiver view on the phone, clear `audio_cache` only if disk is tight.
- Be the person who watches `journalctl -fu blinktalk-api` during the demo.
- For Devpost / Vultr prize write-up: architecture diagram above, "everything runs on one Vultr instance: Caddy + FastAPI + Next.js + SSE",
  uptime and latency numbers.

---

## Timeline at a glance

| Time (Sat → Sun) | Me | Unblocks |
|---|---|---|
| Hour 1 | Vultr box, firewall, Caddy, sslip.io HTTPS with placeholder app | everyone can test camera/mic on HTTPS |
| → 6:30 PM | systemd services, `deploy.sh`, `.env` on server, real app deployed | team tests on the shared URL |
| → 8:00 PM | `api/events.py` merged, Om publishing, Yudi listening | caregiver live alerts |
| → 9:00 PM | health, `status.sh`, first deploy of basic demo | **basic demo milestone** |
| Night | rate limits, uptime check, snapshot, `deploy/README.md` | safe overnight |
| → 9:00 AM | device matrix + latency numbers to Yudi | results page |
| → 10:00 AM | `demo` tag, rollback tested, snapshot | **feature freeze** |
| → 2:30 PM | watch logs, support demo, write infra section | **submission** |

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| Let's Encrypt rate limit / DNS not resolving | switch to `<ip>.sslip.io` (instant) |
| `next build` OOMs on server | add 2 GB swap (`fallocate -l 2G /swapfile && mkswap && swapon`), or build locally and rsync `.next/` |
| SSE events delayed | remove `encode gzip` from `/api/*`; confirm `flush_interval -1`; check `X-Accel-Buffering` |
| Venue Wi-Fi blocks / flaky | phone hotspot; the app's own fallbacks (default phrases, cached audio) keep it usable |
| Bad merge right before demo | `rollback.sh` (git tag) → if server itself is broken, restore Vultr snapshot |
| API credits burn out | rate limits + Om's audio cache; keep a spare key |

## Branches I'll open (in order)
`at/server-setup` → `at/services` → `at/sse` → `at/reliability` → `at/rollback`. Each one is small and merges the same hour it's opened.
