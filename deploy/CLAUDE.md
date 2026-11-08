# CLAUDE.md — Om (infrastructure, deployment, live events)

Project-wide context is in the root `CLAUDE.md`. Full plan: `docs/OM-PLAN.md`.

You are helping **Om**, who owns the Vultr server, HTTPS, deployment of web + api, secrets, the live event stream
(SSE) and keeping the demo environment healthy. AT owns the API routes; Yudi the frontend.

## Om owns
- `deploy/` (Caddyfile, systemd units, setup.sh, deploy.sh, status.sh, rollback.sh), `api/events.py`, `.env.example`
- The public HTTPS URL everyone tests on, by **6:30 PM Saturday**

## Decisions already made
- **systemd, not docker compose.** Caddy from apt, `blinktalk-api.service` (uvicorn, **1 worker**), `blinktalk-web.service` (`next start`).
- App lives at `/srv/blinktalk` (git checkout), secrets at `/srv/blinktalk/.env`, owned by user `deploy`.
- Domain: MLH/hackathon domain if available, otherwise `<ip>.sslip.io`.

## Caddy
```
{$DOMAIN} {
  handle /api/* { reverse_proxy localhost:8000 { flush_interval -1 } }
  handle { reverse_proxy localhost:3000 }
}
```

## api/events.py (SSE broadcaster)
- In-memory set of `asyncio.Queue`s, one per subscriber. `publish(event: str, data: dict)` puts to every queue (non-blocking, drop if full).
- `GET /api/events` → `StreamingResponse` with `text/event-stream`, format `event: <name>\ndata: <json>\n\n`;
  send a `: ping` comment every 15 s; remove the queue on disconnect. Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- AT's routes call `publish("message" | "alert" | "status", data)`.

## Reliability for demo day
- `/api/health` uptime check; `status.sh` shows service status, last 50 log lines and disk use.
- Test from an iPhone/iPad and a laptop on venue Wi-Fi: camera permission, mic permission, SSE alerts arriving on the caregiver device.
- Measure end-to-end latency (question end → audio start) with AT; give numbers to Yudi for the results page.
- Rate-limit `/api/suggest` and `/api/speak` lightly (protect API credits); never log API keys.
- Before 10 AM Sunday: tag a known-good release (`git tag demo`) and know how to roll back in one command.

## Notes for Claude
- Prefer the simplest setup that survives a reboot.
- Keep the Vultr deployment as the one place everything runs (it is the Vultr prize).
- Document every command you run in `deploy/README.md` so anyone can redeploy at 4 AM.
