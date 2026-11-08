# Deploy runbook (anyone can redeploy at 4 AM)

> Filled in as commands are run. Full plan and reasoning: `docs/OM-PLAN.md`.

- **Server:** Vultr, Ubuntu LTS — IP: `64.177.56.221` (Ubuntu 24.04, 2 vCPU / 4 GB, New Jersey)
- **URL:** `https://64-177-56-221.sslip.io` (sslip.io until we get a real domain)
- **SSH:** `ssh deploy@<ip>` (ask Om to add your public key)
- **App dir:** `/srv/blinktalk` · **Secrets:** `/srv/blinktalk/.env` (never in git)

## Common commands
```bash
/srv/blinktalk/deploy/deploy.sh          # deploy latest main
/srv/blinktalk/deploy/status.sh          # services, last logs, disk
/srv/blinktalk/deploy/rollback.sh        # go back to the `demo` tag
journalctl -fu blinktalk-api             # live api logs
sudo systemctl restart blinktalk-api blinktalk-web
```

## Command log
<!-- Om: append every command run on the server here, in order -->

### 2026-11-07 — Phase 1: server setup
```bash
# 1. root had no SSH key after create → logged in with the root password (Vultr Overview page), then on the server:
mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '<your id_ed25519.pub line>' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
# 2. from a laptop in the repo: copy + run the one-time setup (firewall, deploy user, Node 20, Python, Caddy, clone, sudo rule)
scp deploy/setup.sh root@64.177.56.221: && ssh root@64.177.56.221 bash setup.sh
# 3. checks
ssh deploy@64.177.56.221 'sudo -n systemctl reload caddy'   # works without password (only our 3 commands)
curl -I http://64.177.56.221                                 # Caddy default page, HTTP 200
```
Result: node v20.20.2 · caddy v2.11.9 · Python 3.12.3 · ufw allows only 22/80/443.

### 2026-11-07 — Phase 1: HTTPS with Caddy (sslip.io, no domain yet)
```bash
# from a laptop in the repo
scp deploy/Caddyfile root@64.177.56.221:/etc/caddy/Caddyfile
# on the server as root
install -m 600 -o deploy -g deploy /dev/null /srv/blinktalk/.env        # secrets file, only deploy can read
echo "DOMAIN=64-177-56-221.sslip.io" >> /srv/blinktalk/.env
mkdir -p /etc/systemd/system/caddy.service.d
printf "[Service]\nEnvironmentFile=/srv/blinktalk/.env\n" > /etc/systemd/system/caddy.service.d/env.conf   # gives Caddy $DOMAIN
DOMAIN=64-177-56-221.sslip.io caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload && systemctl restart caddy
```
Result: Let's Encrypt cert obtained (expires Feb 2027, Caddy auto-renews). http → https redirect works.
`/` and `/api/health` return 502 until the apps run on :3000 / :8000.
**Switch to a real domain later:** add an A record → 64.177.56.221, change `DOMAIN=` in `/srv/blinktalk/.env`, `systemctl restart caddy`.

### 2026-11-07 — Phase 1: placeholder apps (until the real api/web are deployed)
```bash
# from a laptop in the repo
scp -r deploy/placeholder root@64.177.56.221:/srv/
# on the server as root — temporary services (gone after a reboot, which is fine)
chown -R deploy:deploy /srv/placeholder
systemd-run --unit=placeholder-api --uid=deploy --property=Restart=always python3 /srv/placeholder/health.py
systemd-run --unit=placeholder-web --uid=deploy --property=Restart=always python3 -m http.server 3000 --bind 127.0.0.1 --directory /srv/placeholder
```
Check: `curl https://64-177-56-221.sslip.io/api/health` → `{"ok": true}`; open the URL on a phone → "Test camera and mic".
**Remove before starting the real services (Phase 2):** `systemctl stop placeholder-api placeholder-web`
