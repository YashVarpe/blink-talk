#!/usr/bin/env bash
# One-time server setup for BlinkTalk. Run as root on a fresh Ubuntu 24.04 Vultr box:
#   scp deploy/setup.sh root@<ip>: && ssh root@<ip> bash setup.sh
# Safe to re-run: every step checks whether it's already done.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive   # apt never stops to ask questions

REPO_URL="https://github.com/tupe-atharva/blink-talk.git"
APP_DIR="/srv/blinktalk"

echo "== 1/6 firewall: only SSH, HTTP, HTTPS =="
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo "== 2/6 deploy user (same SSH key as root) =="
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "ERROR: /root/.ssh/authorized_keys is missing or empty. Add your SSH public key to root first (see deploy/README.md)." >&2
  exit 1
fi
mkdir -p /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
# merge root's keys with any teammate keys already added (re-running must not erase them)
sort -u /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys -o /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

echo "== 3/6 base packages + Python =="
apt-get update
apt-get install -y git curl gpg python3-venv python3-pip \
  debian-keyring debian-archive-keyring apt-transport-https

echo "== 4/6 Node.js 20 =="
if ! node -v 2>/dev/null | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "== 5/6 Caddy (official apt repo) =="
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo "== 6/6 app dir, code, sudo rule =="
mkdir -p "$APP_DIR"
chown deploy:deploy "$APP_DIR"
[ -d "$APP_DIR/.git" ] || sudo -u deploy git clone "$REPO_URL" "$APP_DIR"

# deploy may restart ONLY our services without a password (used by deploy.sh)
SUDOERS=/etc/sudoers.d/blinktalk
cat > "$SUDOERS.tmp" <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart blinktalk-api, /usr/bin/systemctl restart blinktalk-web, /usr/bin/systemctl reload caddy
EOF
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp"   # a broken sudoers file can lock you out of sudo; check before installing
mv "$SUDOERS.tmp" "$SUDOERS"

echo
echo "Done. Check: node $(node -v), $(caddy version | cut -d' ' -f1) caddy, $(python3 --version)"
ufw status
