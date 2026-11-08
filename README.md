# BlinkTalk

**Talk with your eyes.** BlinkTalk lets people who can't speak or move (ALS, stroke, paralysis) hold a conversation
using only eye movements and blinks, tracked live in the browser.

The caregiver speaks → Gemini suggests six likely replies → the user looks left/right to move between large reply tiles
and holds a long blink to choose one → ElevenLabs speaks it aloud in the user's own (cloned) voice. Emergency alerts and
messages reach the caregiver's phone instantly.

Built at **UB Hacking 2026**.

---

## How it works

| Step | What happens | Where |
|---|---|---|
| **Sense** | Laptop/iPad camera + MediaPipe face mesh track gaze and blinks. Video frames never leave the browser. | `web/lib/face.ts`, `signals.ts` |
| **Understand** | Caregiver speech is transcribed; Gemini predicts 6 replies from the transcript, conversation history and the user's profile. | `web/lib/stt.ts`, `api/gemini.py` |
| **Act** | The chosen reply is spoken in the user's voice; messages and alerts stream live to the caregiver device. | `api/voice.py`, `api/events.py` |

**Eye controls**

| Gesture | Action |
|---|---|
| Look left / right | Move highlight |
| Long blink (eyes closed 0.45–1.7 s) | Select |
| 5 quick blinks within 2.5 s, or eyes closed 2–4 s | Emergency alert (5 s to cancel with a long blink) |
| Eyes closed > 5 s | Rest mode (long blink wakes) |

After a reply is chosen, the replies stay disabled until the caregiver's next message and its new replies are ready.

## Architecture

```
 Patient device (iPad/laptop)                         Caregiver phone
   camera → MediaPipe (in-browser)                         ▲  live SSE: message | alert | status
          │  HTTPS /api/*                                  │
          ▼                                                │
 ┌──────────────── Vultr server (one domain, HTTPS) ───────┴─────┐
 │  Caddy  ─ /api/* → FastAPI :8000  ─ Gemini, ElevenLabs, SQLite │
 │         └ /*     → Next.js :3000                              │
 └───────────────────────────────────────────────────────────────┘
```

**Stack:** Next.js + TypeScript · MediaPipe · ONNX Runtime Web · FastAPI · SQLite · Gemini · ElevenLabs · Caddy · Vultr

## Repo layout

| Folder | What | Owner |
|---|---|---|
| `web/` | Next.js frontend: talk board, calibration, caregiver view, results | Yudi (eye-tracking libs: Yash) |
| `api/` | FastAPI backend: suggest, speak, messages, alerts, profile | AT (`gemini.py`: Yash, `events.py`: Om) |
| `ml/` | Eye-signal recordings, classifier training, ONNX export | Yash |
| `deploy/` | Vultr server, Caddy HTTPS, systemd, deploy/rollback scripts | Om |
| `docs/` | Team workflow and plans | everyone |

## Run it locally

Requires Python 3.11+ and Node 20+.

```bash
git clone https://github.com/tupe-atharva/blink-talk.git && cd blink-talk
cp .env.example .env            # fill in keys (ask the team; never commit .env)

# backend
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (new terminal)
cd web
npm install
npm run dev                     # http://localhost:3000 — /api/* is proxied to :8000
```

Camera and mic work on `localhost`. On any other host they need HTTPS — use the shared deployed URL.

## Environment variables

See [`.env.example`](.env.example): `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`, `ELEVEN_MODEL`, `DOMAIN`.

## Privacy

Video never leaves the device. Only text (transcripts, chosen phrases) and small events are sent to the server.

## Team docs

- **How we work (branches → PR → main):** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Shared contracts (API, types, env vars):** [CLAUDE.md](CLAUDE.md)
- **Deploy / redeploy runbook:** [deploy/README.md](deploy/README.md)
- **Infra plan:** [docs/OM-PLAN.md](docs/OM-PLAN.md)

## Team

Yash (eye tracking, ML, AI) · Yudi (frontend, UI/UX) · AT (backend, voice) · Om (infrastructure, deployment, live events)
