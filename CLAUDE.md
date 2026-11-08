# CLAUDE.md — BlinkTalk (UB Hacking 2026)

Shared project context for everyone on the team. Role-specific notes live next to the code each person owns
(for example `deploy/CLAUDE.md` for Om). Team workflow: see `docs/WORKFLOW.md`.

## Project

BlinkTalk lets people who can't speak or move (ALS, stroke, paralysis) hold a conversation with their eyes.
A laptop/iPad camera tracks the user's face in the browser (MediaPipe). They move a highlight across large
reply tiles by looking left/right and select with a long blink. Gemini predicts the replies from what the
caregiver just said; ElevenLabs speaks the chosen reply in the user's (cloned) voice.

- **Deadline:** submit by Sun Nov 8, 2:30 PM ET. Feature freeze 10:00 AM. Working basic demo by Sat 9:00 PM.
- **Prizes targeted:** Radial Atoms (AI + physical world: Sense → Understand → Act), Best AI/ML, Gemini, ElevenLabs, Vultr, Best UI/UX.
- **Team:** Yash = eyes/ML + AI layer · Yudi = frontend (+ helps Yash) · AT = backend API + voice · Om = infra, deploy, live events.

## Ground rules for Claude in this repo
- Hackathon: prefer simple, working code over clever code. Smallest change that works. No new dependency unless it saves real time.
- `main` must always run and be demoable. Work on a branch (`yash/...`, `yudi/...`, `om/...`, `at/...`), merge small and often.
- Never edit another person's folder without saying so in the commit message. Shared contracts below change only if all four agree.
- Never commit secrets. Keys live in `.env` (gitignored); `.env.example` lists the names.
- Privacy: video frames never leave the browser. Only text (transcripts, phrases) and events go to the server.
- Every network call has a timeout and a fallback; the UI must never freeze waiting on Gemini or ElevenLabs.

## Repo layout
```
blinktalk/
├── web/                  Next.js + TypeScript (Yudi; Yash owns web/lib/face.ts, signals.ts, calibrate.ts, stt.ts)
│   ├── app/talk/         talk board (main screen)
│   ├── app/calibrate/    calibration
│   ├── app/caregiver/    caregiver view (2nd device)
│   ├── app/results/      measured results for judges
│   ├── lib/face.ts       MediaPipe setup + per-frame features        (Yash)
│   ├── lib/signals.ts    state machine + ONNX classifier → events    (Yash)
│   ├── lib/calibrate.ts  calibration → thresholds                    (Yash)
│   ├── lib/stt.ts        caregiver speech-to-text                    (Yash)
│   ├── lib/api.ts        typed client for the backend                (Yudi)
│   └── public/models/signal.onnx
├── api/                  FastAPI (AT; Yash owns api/gemini.py; Om owns api/events.py)
│   ├── main.py           routes
│   ├── gemini.py         suggest() — prompt + JSON output            (Yash)
│   ├── voice.py          ElevenLabs TTS + audio cache                (AT)
│   ├── events.py         SSE broadcaster                             (Om)
│   ├── db.py             SQLite: profile, messages                   (AT)
│   └── audio_cache/
├── ml/                   recordings/, train.py, export_onnx.py, eval.py (Yash)
├── deploy/               Caddyfile, systemd units, setup.sh, deploy.sh (Om)
└── .env.example
```

## Shared contracts (do not change without telling the team)

**Hosting:** one Vultr server. Caddy serves HTTPS on one domain: `/api/*` → FastAPI on :8000, everything else → Next.js on :3000.
Same origin, so no CORS. Camera and microphone REQUIRE HTTPS (localhost is fine for dev).

**Env vars (.env):** `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`, `ELEVEN_MODEL`, `DOMAIN`.
Frontend calls relative paths (`/api/...`); in dev, Next.js rewrites `/api/*` to `http://localhost:8000`.

**Types**
```ts
type Role = "user" | "caregiver";
type Message = { id: string; role: Role; text: string; ts: string };   // ts = ISO 8601
type Profile = { name: string; caregivers: string[]; needs: string[]; preferences: string[]; commonPhrases: string[] };
```

**HTTP API**
| Method + path | Body | Response |
|---|---|---|
| `POST /api/suggest` | `{ transcript: string \| null, history: Message[], localTime: string }` | `{ phrases: string[] /* exactly 6 */, source: "gemini" \| "fallback" }` |
| `POST /api/speak` | `{ text: string }` | `audio/mpeg` bytes |
| `POST /api/messages` | `{ role: Role, text: string }` | `Message` (also broadcast as SSE `message`) |
| `GET /api/messages?limit=20` | — | `Message[]` newest last |
| `POST /api/alert` | `{ type: "emergency" \| "emergency_cancelled" }` | `204` (broadcast as SSE `alert`) |
| `GET /api/events` | — | SSE stream: events `message` (Message), `alert` ({type, ts}), `status` ({state: "active"\|"resting"\|"face_lost", ts}) |
| `POST /api/status` | `{ state: "active" \| "resting" \| "face_lost" }` | `204` (broadcast as SSE `status`) |
| `GET /api/profile` · `PUT /api/profile` | `Profile` | `Profile` |
| `GET /api/health` | — | `{ ok: true }` |

Timeouts: `/suggest` and `/speak` must answer within 5 s (`/suggest` falls back to default phrases). The 5 s includes a possible ~3 s first-connection TLS delay on the venue Wi-Fi. Frontend: abort every call at 5 s.

**Eye-signal events (web/lib/signals.ts → UI)**
```ts
type SignalEvent =
  | { type: "move"; dir: -1 | 1 }           // look left / right
  | { type: "hold"; progress: number }      // 0..1 while eyes closed, drives the progress ring
  | { type: "select" }                      // long blink completed
  | { type: "emergency" }                   // 5 quick blinks within 2.5 s, or eyes closed 2–4 s (UI shows 5 s cancel)
  | { type: "rest"; on: boolean }           // eyes closed > 5 s / woken by a long blink
  | { type: "face"; found: boolean };       // face lost / found
startTracking(video: HTMLVideoElement, onEvent: (e: SignalEvent) => void): Promise<() => void>; // returns stop()
```
**Speech-to-text (web/lib/stt.ts):** `startListening(onFinal: (text: string) => void, onUnavailable?: () => void): () => void`

**Gemini (api/gemini.py):** `def suggest(transcript: str | None, history: list[Message], profile: Profile, local_time: str) -> list[str]` — always returns exactly 6 phrases or raises.

## Signal rules (v1; classifier replaces the thresholds in v2)
- Eyes closed < 0.4 s → natural blink, ignored (counts toward the 5-blink emergency only). 0.45–1.7 s → `select`. 2–4 s → `emergency`. > 5 s → `rest`.
- Look score above threshold for 0.3 s → `move`; must return to center before the next move.
- 5 short blinks within 2.5 s → `emergency` (re-openings < 0.1 s count as the same blink). No eyebrow gesture, no keyboard.
- Thresholds come from calibration (halfway between resting and action scores per user).
