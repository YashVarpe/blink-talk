# BlinkTalk

Talk with your eyes. BlinkTalk lets people who can't speak or move (ALS, stroke, paralysis) hold a conversation
using only eye movements and blinks, tracked in the browser. Gemini suggests replies from what the caregiver
just said; ElevenLabs speaks the chosen reply in the user's own voice.

Built at UB Hacking 2026.

| Folder | What | Owner |
|---|---|---|
| `web/` | Next.js frontend (talk board, spelling, calibration, caregiver view, results) | Yudi (eye-tracking libs: Yash) |
| `api/` | FastAPI backend (suggest, speak, messages, alerts, profile) | Om (`gemini.py`: Yash, `events.py`: AT) |
| `ml/` | Eye-signal recordings, training, ONNX export | Yash |
| `deploy/` | Vultr server, Caddy HTTPS, systemd, deploy scripts | AT |
| `docs/` | Team workflow and plans | everyone |

- **How we work together:** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Shared contracts (API, types, env vars):** [CLAUDE.md](CLAUDE.md)
- **Deployment / redeploy at 4 AM:** [deploy/README.md](deploy/README.md)
