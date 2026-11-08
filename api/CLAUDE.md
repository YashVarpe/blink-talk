# CLAUDE.md — AT (backend API, data, voice)

Project-wide context is in the root `CLAUDE.md`. Team workflow: `docs/WORKFLOW.md`.

You are helping **AT**, who owns the FastAPI application: routes, SQLite storage, the ElevenLabs voice with its audio
cache, and wiring Yash's Gemini module into `/api/suggest`. Om owns deployment and the live event stream (`api/events.py`).

## AT owns
- `api/main.py` (all routes in the shared contract), `api/db.py`, `api/voice.py`, `api/fallbacks.py`, `api/models.py`
- Voice cloning setup in ElevenLabs (with the chosen teammate's consent) and the `ELEVEN_VOICE_ID`

## Do not edit
`api/gemini.py` (Yash) — call `suggest(...)` from it. `api/events.py` (Om) — call its `publish(event, data)`.
Until those land, use stubs with the same signatures so routes work end to end.

## Routes (exact shapes from the shared contract)
- `POST /api/suggest`: load profile; history = request body `history` (last 6), or the last 6 stored messages if the body sent none; call `gemini.suggest` in a thread with a 3.5 s timeout (the contract limit for the whole call is 5 s);
  on any error/timeout return `fallbacks.phrases(local_time, profile)` with `source: "fallback"`. Always exactly 6 phrases.
- `POST /api/speak`: `voice.speak(text)` → `audio/mpeg`. Cache key = sha1(voice_id + model + text) → `audio_cache/<key>.mp3`.
  On ElevenLabs failure return `503` quickly (frontend falls back to browser speech).
- `POST /api/messages` / `GET /api/messages`: store in SQLite, then `events.publish("message", msg)`.
- `POST /api/alert`, `POST /api/status`: no storage needed beyond a log row; `events.publish(...)`; return `204`.
- `GET/PUT /api/profile`: single profile row stored as JSON; seed a demo profile on first run.
- `GET /api/health`: `{ ok: true }`.

## voice.py
- ElevenLabs text-to-speech REST: `POST https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE_ID}` with header
  `xi-api-key`, JSON `{ "text": ..., "model_id": ELEVEN_MODEL }` (use a low-latency model), `httpx.AsyncClient`, 5 s timeout.
- `warm_cache()` on startup: pre-generate ~30 common phrases (profile `commonPhrases` + fallback phrases) in the background.
- `prefetch(phrases)`: `/suggest` calls it right before replying, so the 6 tiles on screen get their audio generated in the
  background (2 at a time). A `/speak` that arrives while a phrase is still generating joins that call (single-flight),
  so ElevenLabs is never charged twice for the same text.

## ratelimit.py (per client IP, in memory, one worker)
- `/suggest`: 30 per minute. `/speak`: 20 per minute, counted only for text that is NOT already cached (cached audio is free).
- Over the limit -> `429` + `Retry-After`. Frontend: treat `429` like `503` (browser speech / default tiles).
- Client IP = first `X-Forwarded-For` entry, trusted only when the TCP peer is localhost (Caddy). To change limits,
  edit the two `RateLimiter(...)` lines in `main.py`. Venue Wi-Fi may put many devices behind one public IP.

## smoke.sh
`api/smoke.sh [URL] [--full]` checks the main routes and prints PASS/WARN/FAIL (exit 1 on FAIL). Default is safe on the
live demo (no emergency alert, no stored messages). Run it after every deploy.

## fallbacks.py
Time-of-day phrase sets (morning / afternoon / evening / night) + general needs ("I'm in pain", "I need the nurse",
"Thank you", "Yes", "No", "Please wait"). Used when Gemini fails and to pad to 6.

## Data (db.py, SQLite file `api/blinktalk.db`)
Tables: `messages(id TEXT PK, role TEXT, text TEXT, ts TEXT)`, `profile(id INTEGER PK CHECK(id=1), data TEXT)`,
`events_log(id INTEGER PK, kind TEXT, data TEXT, ts TEXT)`. Use the standard `sqlite3` module; no ORM.

## Notes for Claude
- Python 3.11, FastAPI, pydantic v2 models mirroring the shared TS types (camelCase JSON via aliases).
- Keep every handler fast; never block the event loop on network calls (use async httpx or run in a thread).
- Log request time for `/suggest` and `/speak` (Yash and Yudi need latency numbers).
- Dev: `cd api && uvicorn main:app --reload --port 8000` (flat imports, same as the systemd unit). Om runs it in production.
- Local venv: Homebrew Python 3.12 on macOS 26 breaks `ensurepip`; use `uv venv --python 3.12 --managed-python --seed .venv`.
