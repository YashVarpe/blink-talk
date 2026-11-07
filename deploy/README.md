# Deploy runbook (anyone can redeploy at 4 AM)

> Filled in as commands are run. Full plan and reasoning: `docs/AT-PLAN.md`.

- **Server:** Vultr, Ubuntu LTS — IP: `TBD`
- **URL:** `https://TBD`
- **SSH:** `ssh deploy@<ip>` (ask AT to add your public key)
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
<!-- AT: append every command run on the server here, in order -->
