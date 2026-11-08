# Team Workflow — branches, PRs, and getting to `main`

**Rule zero: `main` always runs and is always demoable.** If you aren't sure your change works, it doesn't go to `main` yet.

Team: **Yash** (eyes/ML + AI) · **Yudi** (frontend) · **AT** (backend + voice) · **Om** (infra, deploy, live events).

---

## 1. One-time setup

```bash
git clone https://github.com/tupe-atharva/blink-talk.git
cd blink-talk
git config pull.rebase true        # keeps history linear, fewer merge commits
cp .env.example .env               # fill in keys locally; NEVER commit .env
```

Ask Om for the key values over DM (not in the group chat, never in git).

---

## 2. Who owns what

Stay in your own folder. If you must touch someone else's file, **tell them first** and say so in the commit message
(e.g. `api: add publish() call in main.py (touches AT's file, ok'd by AT)`).

| Owner | Files |
|---|---|
| Yash | `web/lib/face.ts`, `web/lib/signals.ts`, `web/lib/calibrate.ts`, `web/lib/stt.ts`, `api/gemini.py`, `ml/` |
| Yudi | `web/` (everything except Yash's lib files), `web/lib/api.ts` |
| AT | `api/main.py`, `api/voice.py`, `api/db.py` |
| Om | `deploy/`, `api/events.py`, `.env.example`, `.gitignore` |

**Shared contracts** (API routes, types, env var names, `SignalEvent`) are in `CLAUDE.md`. They change only when all four agree —
post in the group chat, get a 👍 from everyone, then update `CLAUDE.md` in the same PR as the code.

---

## 3. Daily loop (do this every time)

```bash
# 1. Start from fresh main
git checkout main
git pull

# 2. Make a branch: <name>/<short-thing>
git checkout -b om/sse-broadcaster      # yash/..., yudi/..., om/..., at/...

# 3. Work, commit small and often
git add <files>                          # add specific files, not `git add .` blindly
git commit -m "events: add SSE broadcaster with 15s ping"

# 4. Before pushing, bring in what others merged
git fetch origin
git rebase origin/main                   # fix conflicts if any, then: git add <file> && git rebase --continue

# 5. Check it still runs locally (see §5), then push
git push -u origin om/sse-broadcaster

# 6. Open a PR into main
gh pr create --base main --fill          # or use the GitHub website
```

After it's merged:
```bash
git checkout main && git pull
git branch -d om/sse-broadcaster
```

**Branch size:** aim for a PR every 1–2 hours. A branch that lives overnight will hurt to merge.

---

## 4. Pull requests

- Title = what changed, e.g. `web: caregiver view listens to SSE alerts`.
- Fill in the PR template (what / how tested / does it touch shared contracts or someone else's folder).
- **One teammate glances at it** before merge. During crunch, a 👍 in chat is enough. If nobody's free within 15 min and it's only your own folder, you may merge it yourself.
- Merge with **"Squash and merge"** so `main` has one clean commit per PR.
- If a PR touches a shared contract or another person's folder, **that person must approve**.

### Commit message style
```
<area>: <what you did>
```
Areas: `web`, `api`, `ml`, `deploy`, `events`, `docs`. Example: `api: /suggest falls back to default phrases after 4s`.

---

## 5. "Does main still run?" checklist before merging

- [ ] `cd api && uvicorn main:app --port 8000` starts with no error
- [ ] `cd web && npm run build` passes
- [ ] The page you changed loads at `http://localhost:3000` and the browser console has no red errors
- [ ] No `.env`, API keys, recordings or `node_modules` in the diff (`git diff --cached --stat`)

---

## 6. Merge conflicts

1. `git fetch origin && git rebase origin/main`
2. Open each conflicted file, keep both sides where it makes sense, delete the `<<<<<<<` / `=======` / `>>>>>>>` markers.
3. `git add <file>` → `git rebase --continue`
4. If the conflict is in someone else's code, **ask them** — don't guess.
5. Totally stuck? `git rebase --abort` puts you back where you were. Then ask in chat.

After a rebase you need `git push --force-with-lease` (never plain `--force`, and never on `main`).

---

## 7. Deploying to the live server (Om runs this; anyone can in an emergency)

`main` is what runs on the Vultr server. After a PR merges:

```bash
ssh deploy@<server>
/srv/blinktalk/deploy/deploy.sh          # git pull → install → build → restart
/srv/blinktalk/deploy/status.sh          # check services are green
```

Public URL: see the pinned message in the group chat. Camera + mic only work over HTTPS, so test there, not on the bare IP.

---

## 8. Timeline & freeze rules

| When | What |
|---|---|
| Sat 6:30 PM | Public HTTPS URL live — everyone tests on it from here on |
| Sat 9:00 PM | Working basic demo on `main` |
| Sun 10:00 AM | **Feature freeze.** `main` is tagged `demo`. After this: bug fixes only, each one approved in chat |
| Sun 2:30 PM | Submission deadline |

After the freeze, if something breaks:
```bash
/srv/blinktalk/deploy/rollback.sh        # puts the server back on the `demo` tag
```

---

## 9. Never do this
- Push directly to `main` (it's protected — use a PR)
- Commit `.env` or paste API keys in code, logs, PRs, or chat
- `git push --force` to `main`
- Send video frames to the server (privacy: only text and events leave the browser)
- Merge something you haven't run
